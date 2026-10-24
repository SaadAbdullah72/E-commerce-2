import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import HeroSlider from '../components/home/HeroSlider';
import FlashTimer from '../components/product/FlashTimer';
import { mockProducts } from '../data/mockProducts';
import { Zap, X, SearchX } from 'lucide-react';

export default function HomePage({ 
  onSelectProduct, 
  selectedCategory, 
  onSelectCategory 
}) {
  const [products] = useState(mockProducts);
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';

  const flashSaleEndTime = new Date(Date.now() + 86400000).toISOString();

  const categoryIcons = [
    { name: "Electronics", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=150&q=80" },
    { name: "Fashion", img: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=150&q=80" },
    { name: "Home & Kitchen", img: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=150&q=80" },
    { name: "Footwear", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80" },
    { name: "Beauty", img: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=150&q=80" },
  ];

  // Dynamic Product Filtering Logic
  const filteredProducts = products.filter((product) => {
    // 1. Search keyword matching
    if (keyword) {
      const matchTitle = product.title?.toLowerCase().includes(keyword.toLowerCase());
      const matchCat = product.category?.toLowerCase().includes(keyword.toLowerCase());
      return matchTitle || matchCat;
    }

    // 2. If no deal or category is selected, return all products
    if (!selectedCategory) return true;

    const catLower = selectedCategory.toLowerCase();

    // 3. Direct category match
    if (product.category && product.category.toLowerCase() === catLower) return true;

    // 4. Match Special Deal Tags assigned in Admin (e.g., "Lightning Deals", "50% OFF Clearance")
    if (
      product.dealTags &&
      product.dealTags.some((tag) => tag.toLowerCase() === catLower)
    ) {
      return true;
    }

    // 5. Dynamic rule for "Under $5 Store"
    if (catLower === 'under $5 store' && Number(product.price) <= 5.0) return true;

    return false;
  });

  // Determines if an active top-level filter is being applied (Search Keyword OR Selected Deal)
  const isFilterActive = Boolean(keyword || selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        
        {/* TOP LEVEL DYNAMIC BANNER: TRIGGERED BY SEARCH OR DEAL PILL CLICK */}
        {isFilterActive ? (
          <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900">
                  {keyword ? (
                    <>Search Results for <span className="text-blue-600">"{keyword}"</span></>
                  ) : (
                    <>Results for <span className="text-blue-600">"{selectedCategory}"</span></>
                  )}
                </h1>
                <p className="text-xs text-gray-500 mt-1">
                  Found {filteredProducts.length} item(s)
                </p>
              </div>

              <button
                onClick={() => {
                  if (keyword) setSearchParams({});
                  if (selectedCategory) onSelectCategory(null);
                }}
                className="text-xs font-bold text-gray-500 hover:text-orange-500 flex items-center gap-1 transition cursor-pointer"
              >
                <X size={14} /> Clear {keyword ? 'Search' : 'Filter'}
              </button>
            </div>

            {/* PRODUCT GRID FOR ACTIVE FILTER */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard 
                    key={product._id} 
                    product={product} 
                    onSelectProduct={onSelectProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <SearchX size={36} className="text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-gray-800">
                  No products found for "{keyword || selectedCategory}"
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Try checking for spelling errors or adding products to this deal tag in the Admin Panel.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD HOMEPAGE FEED (WHEN NO DEAL OR SEARCH IS SELECTED) */
          <>
            <HeroSlider />

            {/* Category Circle Navigation */}
            <div className="my-6 grid grid-cols-5 gap-3 max-w-2xl mx-auto text-center">
              {categoryIcons.map((cat, idx) => (
                <button 
                  key={idx} 
                  onClick={() => onSelectCategory(selectedCategory === cat.name ? null : cat.name)}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition p-0.5 ${
                    selectedCategory === cat.name 
                      ? 'border-orange-500 ring-4 ring-orange-500/20 scale-105' 
                      : 'border-gray-200 group-hover:border-orange-500'
                  }`}>
                    <img src={cat.img} alt={cat.name} className="w-full h-full object-cover rounded-full" />
                  </div>
                  <span className={`text-[11px] font-bold mt-1.5 transition ${
                    selectedCategory === cat.name 
                      ? 'text-orange-500 font-black' 
                      : 'text-gray-700 group-hover:text-orange-500'
                  }`}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Flash Deals Banner */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <div className="bg-orange-500 text-white p-1.5 rounded-lg">
                  <Zap size={18} className="fill-white" />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">
                    Flash Deals
                  </h2>
                  <p className="text-xs text-gray-500">Limited time offer</p>
                </div>
              </div>

              <FlashTimer targetDate={flashSaleEndTime} />
            </div>

            {/* Default Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <ProductCard 
                  key={product._id} 
                  product={product} 
                  onSelectProduct={onSelectProduct}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}