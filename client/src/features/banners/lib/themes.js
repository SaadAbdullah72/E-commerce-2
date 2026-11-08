/**
 * The only looks a banner can have. The database stores just the key, so a banner can never
 * carry arbitrary CSS. Class names are written out in full so Tailwind can see them.
 */
export const BANNER_THEMES = {
  ocean: {
    label: 'Ocean',
    gradient: 'from-blue-700 via-indigo-800 to-blue-900',
    accent: 'bg-orange-500',
  },
  sunset: {
    label: 'Sunset',
    gradient: 'from-orange-600 via-amber-600 to-orange-700',
    accent: 'bg-blue-600',
  },
  midnight: {
    label: 'Midnight',
    gradient: 'from-zinc-900 via-slate-800 to-zinc-900',
    accent: 'bg-orange-500',
  },
};

export const BANNER_THEME_KEYS = Object.keys(BANNER_THEMES);

/** Unknown keys fall back to the first theme. */
export function themeFor(key) {
  return BANNER_THEMES[key] ?? BANNER_THEMES.ocean;
}
