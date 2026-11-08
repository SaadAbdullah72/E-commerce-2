import React, { useState, useEffect } from 'react';
import AnnouncementTicker from '../../features/banners/components/AnnouncementTicker';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Search, User, Zap, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../features/auth/hooks/useAuth';
import logo from '../../assets/Logo.png';

export default function Navbar({ onSearch, onSelectCategory }) {
  const { totalItems, setIsCartOpen } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { status, account } = useAuth();

  const isHomePage = location.pathname === '/';
  const [searchTerm, setSearchTerm] = useState('');

  // Synchronize search input with URL ONLY when on the HomePage
  useEffect(() => {
    if (isHomePage) {
      const urlKeyword = searchParams.get('keyword') || '';
      setSearchTerm(urlKeyword);
    }
  }, [searchParams, isHomePage]);

  const categories = [
    'Lightning Deals',
    'Under $5 Store',
    '50% OFF Clearance',
    'Buy 1 Get 1 Free',
    'Free Shipping Deals',
    'Top Rated items',
  ];

  // Typing Handler:
  // - On Home Page: dynamically updates ?keyword= in the URL.
  // - On Checkout/Other Pages: simply updates local state (NO redirect while erasing/typing).
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (isHomePage) {
      if (val.trim()) {
        setSearchParams({ keyword: val.trim() });
      } else {
        setSearchParams({});
      }
      if (onSearch) onSearch(val);
    }
  };

  // Submit Handler (Pressing Enter or clicking Search Button):
  // - If on Checkout/Other pages, pressing Enter redirects to Home Page with the query.
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    if (!isHomePage) {
      navigate(`/?keyword=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      setSearchParams({ keyword: searchTerm.trim() });
    }

    if (onSearch) onSearch(searchTerm);
  };

  // Clear Button (X) Handler:
  // - Clears input text and updates parameters if on Home Page.
  const handleClearSearch = () => {
    setSearchTerm('');
    if (isHomePage) {
      setSearchParams({});
      if (onSearch) onSearch('');
    }
  };

  const handleCategoryClick = (cat) => {
    if (!isHomePage) {
      navigate('/');
    }
    if (onSelectCategory) {
      onSelectCategory(cat.trim());
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm font-sans">
      {/* 1. ANNOUNCEMENT TICKER (text comes from the database) */}
      <AnnouncementTicker />

      {/* 2. MAIN BRAND HEADER */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {/* Logo */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2 group text-left cursor-pointer">
          <img 
            src={logo} 
            alt="Logo" 
            className="h-9 sm:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-105" 
          />
          <span className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors">
            Shop<span className="text-orange-500">Yaro</span>
          </span>
        </button>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl relative">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search 10,000+ factory-direct deals on ShopYaro..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-5 pr-20 py-2.5 bg-blue-50/50 hover:bg-blue-50 focus:bg-white text-sm font-medium border-2 border-blue-500 rounded-full outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-500/20 text-gray-800"
            />
            
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-12 text-gray-400 hover:text-gray-600 transition p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}

            <button
              type="submit"
              className="absolute right-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white p-2 rounded-full hover:shadow-lg hover:opacity-95 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Search size={18} />
            </button>
          </div>
        </form>

        {/* User & Cart Actions */}
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => navigate(status === 'authenticated' ? '/profile' : '/login')}
            className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition group cursor-pointer"
          >
            <User size={22} className="group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold mt-0.5 max-w-[70px] truncate">
              {status === 'authenticated'
                ? account?.fullName?.split(' ')[0] || 'Profile'
                : 'Sign In'}
            </span>
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex flex-col items-center text-gray-700 hover:text-blue-600 transition group cursor-pointer"
          >
            <div className="relative">
              <ShoppingCart size={24} className="group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2.5 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-white">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold mt-0.5">Cart</span>
          </button>
        </div>
      </div>

      {/* 3. CATEGORY NAV BAR */}
      {isHomePage && (
        <nav className="border-t border-gray-100 bg-gray-50/90 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 flex items-center space-x-4 overflow-x-auto py-2.5 text-xs font-bold text-gray-700 scrollbar-none">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                onClick={() => handleCategoryClick(cat)}
                className={`whitespace-nowrap px-3.5 py-1 rounded-full transition-all duration-150 cursor-pointer ${
                  idx === 0
                    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 flex items-center gap-1'
                    : 'hover:bg-blue-100/60 text-gray-700 hover:text-blue-600'
                }`}
              >
                {idx === 0 && <Zap size={12} className="fill-white" />}
                {cat}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}