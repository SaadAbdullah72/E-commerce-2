import { supabase } from '@/lib/supabase/client';

import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  PARALLEL_UPLOADS,
  validateReviewFile,
  validateVideoDuration,
} from '../lib/reviewRules';

const IMAGE_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\//;
const VIDEO_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/video\/upload\//;

const SIGN_FAILED = 'We could not start the upload. Please try again.';
const UPLOAD_FAILED = 'The upload failed. Please try again.';
export const CANCELLED = 'The upload was cancelled.';

/** Why a slot was refused, in words for the customer. */
const SIGN_STATUS_MESSAGES = {
  429: 'Too many uploads. Please try again in an hour.',
  403: 'Only customers who bought a product can add photos or videos.',
  401: 'Please sign in again to upload.',
};

/**
 * Ask the sign-upload Edge Function for a signed slot. The function checks that this customer has
 * a paid order and applies the limit of 10 uploads per hour, then names the exact public id the
 * file must be uploaded under.
 *
 * @param {string} reviewId
 * @param {'photo' | 'video'} kind
 */
export async function requestReviewSlot(reviewId, kind) {
  const { data, error } = await supabase.functions.invoke('sign-upload', {
    body: { folder: 'reviews', reviewId, kind },
  });
  if (error) {
    throw new Error(SIGN_STATUS_MESSAGES[error.context?.status] ?? SIGN_FAILED);
  }
  if (
    !data?.signature ||
    !data?.uploadUrl ||
    !data?.apiKey ||
    !data?.timestamp ||
    !data?.publicId ||
    !data?.allowedFormats
  ) {
    throw new Error(SIGN_FAILED);
  }
  return data;
}

/**
 * Send the file straight to Cloudinary (it never goes through our server). XMLHttpRequest is used
 * because `fetch` cannot report upload progress. Every signed parameter is sent exactly as signed.
 */
function sendToCloudinary(file, slot, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error(CANCELLED));
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', slot.apiKey);
    form.append('timestamp', String(slot.timestamp));
    form.append('signature', slot.signature);
    form.append('public_id', slot.publicId);
    form.append('asset_folder', slot.assetFolder);
    form.append('allowed_formats', slot.allowedFormats);
    if (slot.transformation) form.append('transformation', slot.transformation);

    request.open('POST', slot.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error(UPLOAD_FAILED));
    request.onabort = () => reject(new Error(CANCELLED));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return reject(new Error(UPLOAD_FAILED));
      try {
        resolve(JSON.parse(request.responseText));
      } catch {
        reject(new Error(UPLOAD_FAILED));
      }
    };
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(form);
  });
}

/**
 * Check, sign and upload one review photo or video.
 *
 * @param {File} file
 * @param {'photo' | 'video'} kind
 * @param {string} reviewId
 * @param {{ onProgress?: (percent: number) => void, signal?: AbortSignal, durationSeconds?: number | null }} [options]
 * @returns {Promise<{ type: 'photo' | 'video', url: string, publicId: string, width: number | null,
 *   height: number | null, durationSeconds: number | null, bytes: number }>}
 */
export async function uploadReviewMedia(file, kind, reviewId, options = {}) {
  const problem = validateReviewFile(file);
  if (problem) throw new Error(problem);

  const slot = await requestReviewSlot(reviewId, kind);
  const result = await sendToCloudinary(file, slot, options);

  // Trust nothing that comes back: it must be our file, in the place we asked for, of this kind.
  const urlPattern = kind === 'photo' ? IMAGE_URL : VIDEO_URL;
  const limit = kind === 'photo' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
  if (
    typeof result?.secure_url !== 'string' ||
    !urlPattern.test(result.secure_url) ||
    result.public_id !== slot.publicId ||
    !Number.isFinite(result.bytes) ||
    result.bytes < 1 ||
    result.bytes > limit
  ) {
    throw new Error(UPLOAD_FAILED);
  }

  const seconds = Number.isFinite(result.duration) ? result.duration : options.durationSeconds;
  return {
    type: kind,
    url: result.secure_url,
    publicId: result.public_id,
    width: Number.isInteger(result.width) ? result.width : null,
    height: Number.isInteger(result.height) ? result.height : null,
    durationSeconds: kind === 'video' && Number.isFinite(seconds) ? seconds : null,
    bytes: Math.round(result.bytes),
  };
}

/**
 * How long is this video? Read from the file itself in the browser (nothing is uploaded).
 * @param {File} file
 * @returns {Promise<number>} seconds, or NaN when the browser cannot read it
 */
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = (value) => {
      clearTimeout(timer);
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(Number.NaN), 8000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(Number.NaN);
    video.src = url;
  });
}

/** Check the length of a video before it is uploaded. Returns { problem, seconds }. */
export async function checkVideoFile(file) {
  const seconds = await readVideoDuration(file);
  return { seconds, problem: validateVideoDuration(file.name, seconds) };
}

/**
 * A queue that runs at most `limit` jobs at once; more can be added at any time and wait their
 * turn. Each job is a function returning a promise. `add` answers with that job's own result (or
 * its error), so one failure never stops the others.
 *
 * @param {number} [limit]
 */
export function createUploadQueue(limit = PARALLEL_UPLOADS) {
  let running = 0;
  const waiting = [];

  const pump = () => {
    while (running < limit && waiting.length > 0) {
      const { job, resolve, reject } = waiting.shift();
      running += 1;
      job()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          pump();
        });
    }
  };

  return {
    add: (job) =>
      new Promise((resolve, reject) => {
        waiting.push({ job, resolve, reject });
        pump();
      }),
    get running() {
      return running;
    },
    get waiting() {
      return waiting.length;
    },
  };
}
