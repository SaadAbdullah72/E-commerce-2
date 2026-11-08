import { ArrowRight } from 'lucide-react';

import { themeFor } from '@/features/banners/lib/themes';

/**
 * A small, non-interactive picture of how a banner will look. Shown beside the form and in the
 * list. Uses the same theme table as the shop, so what you see is what visitors get.
 *
 * @param {{ kind: 'hero' | 'announcement', title: string, badge?: string, subtitle?: string,
 *   buttonText?: string, theme: string, imageUrl?: string | null }} props
 */
export default function BannerPreview({
  kind,
  title,
  badge,
  subtitle,
  buttonText,
  theme,
  imageUrl,
}) {
  const look = themeFor(theme);

  if (kind === 'announcement') {
    return (
      <div className="rounded-md bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-3 py-2 text-xs font-bold text-white">
        {title || 'Your announcement'}
      </div>
    );
  }

  return (
    <div
      className={`flex h-28 items-center justify-between overflow-hidden rounded-lg bg-gradient-to-r px-4 text-white ${look.gradient}`}
    >
      <div className="min-w-0 space-y-1">
        {badge && (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${look.accent}`}
          >
            {badge}
          </span>
        )}
        <p className="truncate text-lg leading-tight font-black">{title || 'Your headline'}</p>
        {subtitle && <p className="truncate text-[11px] text-gray-200">{subtitle}</p>}
        {buttonText && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-gray-900">
            {buttonText} <ArrowRight size={10} aria-hidden="true" />
          </span>
        )}
      </div>
      {imageUrl && (
        <img src={imageUrl} alt="" className="ml-3 h-20 w-20 shrink-0 rounded-md object-cover" />
      )}
    </div>
  );
}
