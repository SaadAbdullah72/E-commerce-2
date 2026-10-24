import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Zap, ArrowRight } from 'lucide-react';

export default function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      badge: "SHOPYARO EXCLUSIVE",
      title: "UP TO 90% OFF",
      subtitle: "Factory Direct Clearance Deals",
      buttonText: "Shop Deals Now",
      bgGradient: "from-blue-700 via-indigo-800 to-blue-900",
      accentColor: "bg-orange-500",
      image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 2,
      badge: "LIGHTNING SALE",
      title: "UNDER $9.99",
      subtitle: "Trending Tech & Smart Gadgets",
      buttonText: "Claim Discount",
      bgGradient: "from-orange-600 via-amber-600 to-orange-700",
      accentColor: "bg-blue-600",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 3,
      badge: "EXPRESS DELIVERY",
      title: "FREE SHIPPING",
      subtitle: "On All Orders Today • 90-Day Returns",
      buttonText: "Explore More",
      bgGradient: "from-zinc-900 via-slate-800 to-zinc-900",
      accentColor: "bg-orange-500",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative w-full h-[220px] sm:h-[300px] md:h-[360px] overflow-hidden rounded-2xl shadow-lg my-4 bg-gray-900">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out flex items-center justify-between px-6 sm:px-12 md:px-16 ${
            index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
          } bg-gradient-to-r ${slide.bgGradient}`}
        >
          {/* Text Content */}
          <div className="max-w-xl text-white z-20 space-y-2 sm:space-y-3">
            <span className={`inline-block text-[10px] sm:text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${slide.accentColor} tracking-wider`}>
              {slide.badge}
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none text-white">
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-gray-200">
              {slide.subtitle}
            </p>
            <button className="mt-2 inline-flex items-center gap-1.5 bg-white text-gray-900 hover:bg-orange-500 hover:text-white font-extrabold text-xs sm:text-sm px-4 sm:px-6 py-2 rounded-full shadow-md transition-all duration-200">
              <span>{slide.buttonText}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Sliding Product Image */}
          <div className="hidden sm:block relative z-20 w-48 h-48 md:w-64 md:h-64 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 transform rotate-2 hover:rotate-0 transition-transform duration-300">
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ))}

      {/* Navigation Controls */}
      <button
        onClick={() => setCurrentSlide(currentSlide === 0 ? slides.length - 1 : currentSlide - 1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-black/30 hover:bg-black/60 text-white p-1.5 sm:p-2 rounded-full backdrop-blur transition"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => setCurrentSlide(currentSlide === slides.length - 1 ? 0 : currentSlide + 1)}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-30 bg-black/30 hover:bg-black/60 text-white p-1.5 sm:p-2 rounded-full backdrop-blur transition"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentSlide ? 'bg-orange-500 w-6' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}