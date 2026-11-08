import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useLiveBanners } from '../../features/banners/hooks/useLiveBanners';
import { themeFor } from '../../features/banners/lib/themes';

const ROTATE_MS = 4500;
const FRAME =
  'relative w-full h-[220px] sm:h-[300px] md:h-[360px] overflow-hidden rounded-2xl shadow-lg my-4';

/**
 * The big banner on the home page. The slides come from the database (Admin > Banners).
 * While they load a grey placeholder holds the space; with none live, or if the request
 * fails, the banner is left out rather than showing made-up content.
 */
export default function HeroSlider() {
  const { data: slides, isPending } = useLiveBanners('hero');
  const [requested, setRequested] = useState(0);

  const count = slides?.length ?? 0;
  // If slides are removed while the page is open, stay on a slide that still exists.
  const current = count > 0 ? Math.min(requested, count - 1) : 0;

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(
      () => setRequested((index) => (index >= count - 1 ? 0 : index + 1)),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [count]);

  if (isPending) {
    return (
      <div
        role="status"
        aria-label="Loading banner"
        className={`${FRAME} animate-pulse bg-gray-200`}
      />
    );
  }
  if (count === 0) return null;

  const go = (index) => setRequested((index + count) % count);

  return (
    <div
      className={`${FRAME} bg-gray-900`}
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      {slides.map((slide, index) => {
        const theme = themeFor(slide.theme);
        return (
          <div
            key={slide.id}
            aria-hidden={index !== current}
            className={`absolute inset-0 flex items-center justify-between bg-gradient-to-r px-6 transition-opacity duration-700 ease-in-out sm:px-12 md:px-16 ${theme.gradient} ${
              index === current ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'
            }`}
          >
            <div className="z-20 max-w-xl space-y-2 text-white sm:space-y-3">
              {slide.badge && (
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase sm:text-xs ${theme.accent} tracking-wider`}
                >
                  {slide.badge}
                </span>
              )}
              <h2 className="text-2xl leading-none font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="text-xs font-medium text-gray-200 sm:text-sm">{slide.subtitle}</p>
              )}
              {slide.buttonText && slide.linkPath && (
                <Link
                  to={slide.linkPath}
                  tabIndex={index === current ? 0 : -1}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-gray-900 shadow-md transition-all duration-200 hover:bg-orange-500 hover:text-white sm:px-6 sm:text-sm"
                >
                  <span>{slide.buttonText}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>

            {slide.imageUrl && (
              <div className="relative z-20 hidden h-48 w-48 rotate-2 transform overflow-hidden rounded-xl border-2 border-white/20 shadow-2xl transition-transform duration-300 hover:rotate-0 sm:block md:h-64 md:w-64">
                <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(current - 1)}
            className="absolute top-1/2 left-3 z-30 -translate-y-1/2 cursor-pointer rounded-full bg-black/30 p-1.5 text-white backdrop-blur transition hover:bg-black/60 sm:p-2"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(current + 1)}
            className="absolute top-1/2 right-3 z-30 -translate-y-1/2 cursor-pointer rounded-full bg-black/30 p-1.5 text-white backdrop-blur transition hover:bg-black/60 sm:p-2"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 space-x-2">
            {slides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === current}
                onClick={() => go(index)}
                className={`h-2 cursor-pointer rounded-full transition-all ${
                  index === current ? 'w-6 bg-orange-500' : 'w-2 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
