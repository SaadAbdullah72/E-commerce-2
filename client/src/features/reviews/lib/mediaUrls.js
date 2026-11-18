const CLOUDINARY =
  /^(https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/(?:image|video)\/upload\/)(.+)$/;

/** A small cropped picture for a grid. Anything that is not a Cloudinary address is left as is. */
export function thumbnailUrl(url, size = 320) {
  const match = CLOUDINARY.exec(url ?? '');
  if (!match) return url;
  return `${match[1]}c_fill,w_${size},h_${size},q_auto,f_auto/${match[2]}`;
}

/** A picture that fits a lightbox. */
export function largeUrl(url, width = 1600) {
  const match = CLOUDINARY.exec(url ?? '');
  if (!match) return url;
  return `${match[1]}c_limit,w_${width},q_auto,f_auto/${match[2]}`;
}

/** The first frame of a Cloudinary video, as a picture (same address with a .jpg ending). */
export function videoPosterUrl(url) {
  const match = CLOUDINARY.exec(url ?? '');
  if (!match) return null;
  return `${match[1]}so_0,c_fill,w_320,h_320/${match[2].replace(/\.[A-Za-z0-9]+$/, '')}.jpg`;
}

/** "0:12" */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
