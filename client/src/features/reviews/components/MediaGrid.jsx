import { Play } from 'lucide-react';
import { useState } from 'react';

import { formatDuration, thumbnailUrl, videoPosterUrl } from '../lib/mediaUrls';
import { Lightbox, VideoModal } from './MediaViewers';

const MAX_VISIBLE = 8; // two rows of four

/**
 * The photos and video of one review: small tiles. A photo opens the lightbox, the video opens the
 * video box. Beyond two rows the rest is behind "Show all".
 *
 * @param {{ media: { id: string, type: 'photo' | 'video', url: string, durationSeconds?: number | null }[],
 *   maxVisible?: number }} props
 */
export default function MediaGrid({ media, maxVisible = MAX_VISIBLE }) {
  const [showAll, setShowAll] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(null);
  const [video, setVideo] = useState(null);

  if (media.length === 0) return null;

  const photos = media.filter((item) => item.type === 'photo');
  const visible = showAll ? media : media.slice(0, maxVisible);
  const hidden = media.length - visible.length;

  return (
    <div className="mt-2">
      <ul className="grid grid-cols-4 gap-2 sm:max-w-sm" aria-label="Customer photos and video">
        {visible.map((item) => {
          const isVideo = item.type === 'video';
          const poster = isVideo ? videoPosterUrl(item.url) : null;
          const photoNumber = photos.findIndex((photo) => photo.id === item.id) + 1;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  isVideo ? setVideo(item) : setPhotoIndex(photos.findIndex((p) => p.id === item.id))
                }
                aria-label={isVideo ? 'Play customer video' : `Open photo ${photoNumber}`}
                className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {(!isVideo || poster) && (
                  <img
                    src={isVideo ? poster : thumbnailUrl(item.url)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                    <Play size={20} aria-hidden="true" className="fill-white" />
                    {Number.isFinite(item.durationSeconds) && (
                      <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[9px] font-bold">
                        {formatDuration(item.durationSeconds)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 cursor-pointer text-xs font-bold text-blue-600 underline"
        >
          Show all ({media.length})
        </button>
      )}

      {photoIndex !== null && (
        <Lightbox
          photos={photos}
          index={photoIndex}
          onIndex={setPhotoIndex}
          onClose={() => setPhotoIndex(null)}
        />
      )}
      {video && <VideoModal video={video} onClose={() => setVideo(null)} />}
    </div>
  );
}
