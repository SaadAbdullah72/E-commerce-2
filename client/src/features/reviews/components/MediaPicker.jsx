import { Film, ImagePlus, RotateCcw, X } from 'lucide-react';
import { useRef } from 'react';

import { thumbnailUrl, videoPosterUrl } from '../lib/mediaUrls';
import {
  formatBytes,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MAX_VIDEOS,
} from '../lib/reviewRules';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';

function Preview({ item }) {
  if (item.kind === 'photo') {
    const src = item.previewUrl ?? (item.savedUrl ? thumbnailUrl(item.savedUrl, 160) : null);
    return src ? (
      <img src={src} alt="" className="h-full w-full object-cover" />
    ) : (
      <ImagePlus size={20} aria-hidden="true" className="text-gray-400" />
    );
  }
  const poster = item.savedUrl ? videoPosterUrl(item.savedUrl) : null;
  if (item.previewUrl) {
    return (
      <video src={item.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
    );
  }
  return poster ? (
    <img src={poster} alt="" className="h-full w-full object-cover" />
  ) : (
    <Film size={20} aria-hidden="true" className="text-gray-400" />
  );
}

/**
 * Choose, preview, upload, retry and remove the photos and the video of a review.
 *
 * @param {{ uploads: ReturnType<typeof import('../hooks/useMediaUploads').useMediaUploads>,
 *   disabled?: boolean }} props
 */
export default function MediaPicker({ uploads, disabled = false }) {
  const input = useRef(null);
  const { items, notices, photoCount, videoCount } = uploads;
  const full = photoCount >= MAX_PHOTOS && videoCount >= MAX_VIDEOS;

  const choose = (event) => {
    uploads.addFiles(event.target.files);
    event.target.value = ''; // so the same file can be chosen again after removing it
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="flex w-full items-center justify-between text-xs font-bold text-gray-900">
        <span>Photos and video (optional)</span>
        <span
          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600"
          aria-label={`${photoCount} of ${MAX_PHOTOS} photos, ${videoCount} of ${MAX_VIDEOS} video`}
        >
          {photoCount}/{MAX_PHOTOS} photos · {videoCount}/{MAX_VIDEOS} video
        </span>
      </legend>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={choose}
        className="sr-only"
        aria-label="Add photos or a video"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={full || disabled}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ImagePlus size={14} aria-hidden="true" /> Add photos or video
      </button>
      <p className="text-[11px] text-gray-500">
        Up to {MAX_PHOTOS} photos (JPG, PNG or WebP, {formatBytes(MAX_PHOTO_BYTES)} each) and{' '}
        {MAX_VIDEOS} video (MP4 or WebM, {formatBytes(MAX_VIDEO_BYTES)}, {MAX_VIDEO_SECONDS} seconds).
      </p>

      {notices.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-xs text-red-600">
          {notices.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const photoNumber = items.filter((entry) => entry.kind === 'photo').indexOf(item) + 1;
            const name = item.kind === 'photo' ? `photo ${photoNumber}` : 'video';
            const uploading = item.status === 'uploading' || item.status === 'checking';
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-2"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
                  <Preview item={item} />
                </span>
                <span className="min-w-0 flex-1 text-xs">
                  <span className="block truncate font-semibold text-gray-900">
                    {item.file ? item.name : item.kind === 'video' ? 'Saved video' : 'Saved photo'}
                  </span>
                  {uploading && (
                    <span className="mt-1 flex items-center gap-2">
                      <progress
                        value={item.status === 'checking' ? 0 : item.progress}
                        max="100"
                        aria-label={`Uploading ${name}`}
                        className="h-1.5 w-full max-w-40"
                      />
                      <span className="font-semibold text-gray-600" aria-live="off">
                        {item.status === 'checking' ? 'Checking…' : `${item.progress}%`}
                      </span>
                    </span>
                  )}
                  {item.status === 'done' && (
                    <span className="block font-semibold text-green-700">
                      {item.file ? 'Uploaded' : 'Saved'}
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span role="alert" className="block text-red-600">
                      {item.error}
                    </span>
                  )}
                </span>
                {item.status === 'error' && item.file && (
                  <button
                    type="button"
                    onClick={() => uploads.retry(item.key)}
                    aria-label={`Retry ${name}`}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    <RotateCcw size={12} aria-hidden="true" /> Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => uploads.remove(item.key)}
                  aria-label={`Remove ${name}`}
                  className="cursor-pointer rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
