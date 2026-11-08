import { supabase } from '@/lib/supabase/client';

import { validateImageFile } from '../lib/uploadRules';

const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\//;
const SIGN_ERROR = 'We could not start the upload. Please try again.';
const UPLOAD_ERROR = 'The upload failed. Please try again.';

/**
 * Ask the Edge Function for a signed upload. Only a signed-in admin gets one.
 * @param {'products' | 'categories'} folder
 */
export async function requestUploadSignature(folder) {
  const { data, error } = await supabase.functions.invoke('sign-upload', { body: { folder } });
  if (
    error ||
    !data?.signature ||
    !data?.uploadUrl ||
    !data?.apiKey ||
    !data?.timestamp ||
    !data?.publicId
  ) {
    throw new Error(SIGN_ERROR);
  }
  return data;
}

/**
 * Send the file straight to Cloudinary (it never goes through our server).
 * XMLHttpRequest is used because `fetch` cannot report upload progress.
 */
function sendToCloudinary(file, signature, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signature.apiKey);
    form.append('timestamp', String(signature.timestamp));
    form.append('signature', signature.signature);
    form.append('public_id', signature.publicId);
    form.append('asset_folder', signature.assetFolder);
    form.append('allowed_formats', signature.allowedFormats);

    request.open('POST', signature.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error(UPLOAD_ERROR));
    request.onabort = () => reject(new Error('The upload was cancelled.'));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return reject(new Error(UPLOAD_ERROR));
      try {
        resolve(JSON.parse(request.responseText));
      } catch {
        reject(new Error(UPLOAD_ERROR));
      }
    };

    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(form);
  });
}

/**
 * Check, sign and upload one image.
 *
 * @param {File} file
 * @param {'products' | 'categories'} folder
 * @param {{ onProgress?: (percent: number) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export async function uploadImage(file, folder, options = {}) {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const signature = await requestUploadSignature(folder);
  const result = await sendToCloudinary(file, signature, options);

  // Trust nothing that comes back: it must be our image, in the place we asked for.
  if (
    typeof result?.secure_url !== 'string' ||
    !CLOUDINARY_URL.test(result.secure_url) ||
    result.public_id !== signature.publicId
  ) {
    throw new Error(UPLOAD_ERROR);
  }
  return { url: result.secure_url, publicId: result.public_id };
}
