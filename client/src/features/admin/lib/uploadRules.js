export const MAX_IMAGES_PER_PRODUCT = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Browser-side check before anything is uploaded. Cloudinary and the Edge Function check again.
 * @param {{ name: string, type: string, size: number }} file
 * @returns {string | null} a message, or null when the file is fine
 */
export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG or WebP images are allowed.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: the file is larger than 5 MB.`;
  }
  if (file.size === 0) {
    return `${file.name}: the file is empty.`;
  }
  return null;
}
