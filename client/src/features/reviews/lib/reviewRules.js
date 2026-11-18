// Review limits. They mirror the database (0013_reviews.sql, review_validate_media). The browser
// checks first for a quick answer; the database checks again and has the last word.
export const MAX_PHOTOS = 3;
export const MAX_VIDEOS = 1;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SECONDS = 60;
export const MAX_TITLE = 100;
export const MAX_COMMENT = 2000;
export const PARALLEL_UPLOADS = 3;

export const PHOTO_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};
export const VIDEO_TYPES = { 'video/mp4': ['mp4'], 'video/webm': ['webm'] };

// Anything that could be run on a server or by a browser, even hidden behind a second extension
// ("photo.php.jpg"). Cloudinary only stores pictures and videos, so this is a cheap extra lock.
const SUSPICIOUS =
  /\.(php\d?|phtml|js|mjs|html?|svg|exe|bat|cmd|sh|jar|dll|msi|vbs|ps1|py|pl|asp|aspx|jsp|cgi)(\.|$)/i;

// A comment may have line breaks (tab, newline, carriage return) but no other control character.
// eslint-disable-next-line no-control-regex -- control characters are exactly what this rejects
const COMMENT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex -- control characters are exactly what this rejects
const TITLE_CONTROL = /[\u0000-\u001f\u007f]/;

const extensionOf = (name) => {
  const match = /\.([A-Za-z0-9]+)$/.exec(name ?? '');
  return match ? match[1].toLowerCase() : '';
};

/**
 * Which kind of review file is this? Decided by the declared type AND the file extension, which
 * must agree. Returns null for anything else.
 *
 * @param {{ name: string, type: string }} file
 * @returns {'photo' | 'video' | null}
 */
export function classifyFile(file) {
  if (!file || SUSPICIOUS.test(file.name ?? '')) return null;
  const extension = extensionOf(file.name);
  if (PHOTO_TYPES[file.type]?.includes(extension)) return 'photo';
  if (VIDEO_TYPES[file.type]?.includes(extension)) return 'video';
  return null;
}

/**
 * Browser-side check of one file (type and size). Duration is checked separately because it needs
 * the file to be read. Returns a message, or null when the file is fine.
 *
 * @param {{ name: string, type: string, size: number }} file
 */
export function validateReviewFile(file) {
  const kind = classifyFile(file);
  if (!kind) {
    return `${file.name}: only JPG, PNG or WebP photos and MP4 or WebM videos are allowed.`;
  }
  if (file.size === 0) return `${file.name}: the file is empty.`;
  if (kind === 'photo' && file.size > MAX_PHOTO_BYTES) {
    return `${file.name}: photos can be up to 5 MB.`;
  }
  if (kind === 'video' && file.size > MAX_VIDEO_BYTES) {
    return `${file.name}: videos can be up to 10 MB.`;
  }
  return null;
}

/** The video length limit, checked once the length is known. */
export function validateVideoDuration(name, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return `${name}: we could not read this video.`;
  if (seconds > MAX_VIDEO_SECONDS) return `${name}: videos can be up to 60 seconds.`;
  return null;
}

/**
 * Can one more file of this kind be added?
 * @param {{ kind: 'photo' | 'video' }[]} items files already in the form
 * @param {'photo' | 'video'} kind
 */
export function slotMessage(items, kind) {
  const same = items.filter((item) => item.kind === kind).length;
  if (kind === 'photo' && same >= MAX_PHOTOS) return `You can add up to ${MAX_PHOTOS} photos.`;
  if (kind === 'video' && same >= MAX_VIDEOS) return `You can add ${MAX_VIDEOS} video.`;
  return null;
}

/** @returns {string} a message, or '' when the title is fine (it is optional) */
export function validateTitle(value) {
  const text = String(value ?? '').trim();
  if (text.length > MAX_TITLE) return `The title can be up to ${MAX_TITLE} characters.`;
  if (TITLE_CONTROL.test(text)) return 'The title contains characters that are not allowed.';
  return '';
}

/** @returns {string} a message, or '' when the comment is fine (it is optional) */
export function validateComment(value) {
  const text = String(value ?? '').trim();
  if (text.length > MAX_COMMENT) return `The comment can be up to ${MAX_COMMENT} characters.`;
  if (COMMENT_CONTROL.test(text)) return 'The comment contains characters that are not allowed.';
  return '';
}

export const validateRating = (rating) =>
  Number.isInteger(rating) && rating >= 1 && rating <= 5 ? '' : 'Please choose a star rating.';

/** "1.2 MB", "340 KB" */
export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
