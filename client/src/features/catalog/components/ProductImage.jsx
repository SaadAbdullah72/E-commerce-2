import { ImageOff } from 'lucide-react';
import { useState } from 'react';

/**
 * Product picture with a built-in placeholder, used when a product has no image yet or the
 * image fails to load. No external placeholder service.
 *
 * @param {object} props
 * @param {string | null | undefined} props.src
 * @param {string} props.alt
 * @param {string} [props.className]
 */
export default function ProductImage({ src, alt, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}
      >
        <ImageOff size={28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}
