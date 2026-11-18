import { useCallback, useEffect, useRef, useState } from 'react';

import { classifyFile, slotMessage, validateReviewFile } from '../lib/reviewRules';
import {
  CANCELLED,
  checkVideoFile,
  createUploadQueue,
  uploadReviewMedia,
} from '../services/mediaUploadService';

const makePreview = (file) =>
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
const dropPreview = (url) => {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
};

/** A file that is already saved on the review (editing): nothing to upload. */
const fromSaved = (media) => ({
  key: media.id,
  kind: media.type,
  name: media.type === 'video' ? 'Saved video' : 'Saved photo',
  status: 'done',
  progress: 100,
  error: '',
  previewUrl: null,
  savedUrl: media.url,
  file: null,
  media: {
    type: media.type,
    url: media.url,
    publicId: media.publicId,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
    bytes: media.bytes,
  },
});

/**
 * The photos and video of a review form: checks each file, uploads it at once (3 at a time),
 * reports progress, and lets the customer retry or remove a file.
 *
 * Statuses: checking (reading a video's length) -> uploading -> done | error.
 *
 * @param {string} reviewId the id this review will have (files are uploaded into a folder named after it)
 * @param {{ id: string, type: 'photo' | 'video', url: string, publicId: string, width: number | null,
 *   height: number | null, durationSeconds: number | null, bytes: number }[]} [saved] files the review already has
 */
export function useMediaUploads(reviewId, saved = []) {
  const [items, setItems] = useState(() => saved.map(fromSaved));
  const [notices, setNotices] = useState([]);
  const [queue] = useState(() => createUploadQueue());
  const itemsRef = useRef(items);
  const controllers = useRef(new Map());

  // Keep the ref and the screen in step. Safe to call from async callbacks.
  const commit = useCallback((change) => {
    itemsRef.current = change(itemsRef.current);
    setItems(itemsRef.current);
  }, []);
  const patch = useCallback(
    (key, fields) =>
      commit((list) => list.map((item) => (item.key === key ? { ...item, ...fields } : item))),
    [commit],
  );
  const exists = (key) => itemsRef.current.some((item) => item.key === key);

  const upload = useCallback(
    (item) => {
      const controller = new AbortController();
      controllers.current.set(item.key, controller);
      patch(item.key, { status: 'uploading', progress: 0, error: '' });

      queue
        .add(() =>
          uploadReviewMedia(item.file, item.kind, reviewId, {
            signal: controller.signal,
            durationSeconds: item.durationSeconds,
            onProgress: (percent) => {
              if (exists(item.key)) patch(item.key, { progress: percent });
            },
          }),
        )
        .then((media) => {
          if (exists(item.key)) patch(item.key, { status: 'done', progress: 100, media });
        })
        .catch((error) => {
          if (error?.message === CANCELLED || !exists(item.key)) return;
          patch(item.key, { status: 'error', error: error?.message ?? 'The upload failed.' });
        })
        .finally(() => controllers.current.delete(item.key));
    },
    [patch, queue, reviewId],
  );

  const addFiles = useCallback(
    async (fileList) => {
      const messages = [];
      for (const file of Array.from(fileList ?? [])) {
        const problem = validateReviewFile(file);
        if (problem) {
          messages.push(problem);
          continue;
        }
        const kind = classifyFile(file);
        const full = slotMessage(itemsRef.current, kind);
        if (full) {
          messages.push(`${file.name}: ${full}`);
          continue;
        }

        // The slot is taken straight away so two files chosen together cannot both slip in.
        const item = {
          key: crypto.randomUUID(),
          kind,
          name: file.name,
          size: file.size,
          status: kind === 'video' ? 'checking' : 'uploading',
          progress: 0,
          error: '',
          previewUrl: makePreview(file),
          savedUrl: null,
          file,
          durationSeconds: null,
          media: null,
        };
        commit((list) => [...list, item]);

        if (kind === 'video') {
          const { seconds, problem: videoProblem } = await checkVideoFile(file);
          if (!exists(item.key)) continue; // removed while we were reading it
          if (videoProblem) {
            dropPreview(item.previewUrl);
            commit((list) => list.filter((entry) => entry.key !== item.key));
            messages.push(videoProblem);
            continue;
          }
          item.durationSeconds = seconds;
        }
        upload(item);
      }
      setNotices(messages);
    },
    [commit, upload],
  );

  const remove = useCallback(
    (key) => {
      controllers.current.get(key)?.abort();
      const item = itemsRef.current.find((entry) => entry.key === key);
      dropPreview(item?.previewUrl);
      commit((list) => list.filter((entry) => entry.key !== key));
    },
    [commit],
  );

  const retry = useCallback(
    (key) => {
      const item = itemsRef.current.find((entry) => entry.key === key);
      if (item?.file && item.status === 'error') upload(item);
    },
    [upload],
  );

  // Leaving the form: stop what is still uploading and free the previews.
  useEffect(() => {
    const running = controllers.current;
    return () => {
      running.forEach((controller) => controller.abort());
      itemsRef.current.forEach((item) => dropPreview(item.previewUrl));
    };
  }, []);

  return {
    items,
    notices,
    addFiles,
    remove,
    retry,
    clearNotices: () => setNotices([]),
    busy: items.some((item) => item.status === 'checking' || item.status === 'uploading'),
    hasError: items.some((item) => item.status === 'error'),
    media: items.filter((item) => item.status === 'done').map((item) => item.media),
    photoCount: items.filter((item) => item.kind === 'photo').length,
    videoCount: items.filter((item) => item.kind === 'video').length,
  };
}
