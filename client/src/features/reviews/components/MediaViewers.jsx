import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';

import { largeUrl } from '../lib/mediaUrls';
import MediaModal from './MediaModal';

/**
 * Photos of a review, one at a time, with Previous / Next (and the arrow keys).
 * @param {{ photos: { id: string, url: string }[], index: number,
 *   onIndex: (index: number) => void, onClose: () => void }} props
 */
export function Lightbox({ photos, index, onIndex, onClose }) {
  const count = photos.length;
  const go = (step) => onIndex((index + step + count) % count);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') onIndex((index - 1 + count) % count);
      if (event.key === 'ArrowRight') onIndex((index + 1) % count);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, count, onIndex]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <MediaModal label={`Photo ${index + 1} of ${count}`} onClose={onClose}>
      <img
        src={largeUrl(photo.url)}
        alt={`Customer photo ${index + 1} of ${count}`}
        className="max-h-[75vh] max-w-full rounded-lg object-contain"
      />
      {count > 1 && (
        <div className="mt-3 flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="cursor-pointer rounded-full bg-white/20 p-2 hover:bg-white/30"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="text-xs font-semibold" aria-live="polite">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="cursor-pointer rounded-full bg-white/20 p-2 hover:bg-white/30"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </MediaModal>
  );
}

/** @param {{ video: { url: string }, onClose: () => void }} props */
export function VideoModal({ video, onClose }) {
  return (
    <MediaModal label="Customer video" onClose={onClose}>
      <video
        src={video.url}
        controls
        autoPlay
        playsInline
        className="max-h-[75vh] max-w-full rounded-lg bg-black"
      />
    </MediaModal>
  );
}
