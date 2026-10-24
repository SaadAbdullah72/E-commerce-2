import React from 'react';
import ProductCard from '../components/product/ProductCard';
import { mockProducts } from '../data/mockProducts';
import { ChevronRight, Layers } from 'lucide-react';

export default function CategoryPage({ 
  categoryName, 
  onSelectProduct, 
  onNavigateHome, 
  onSelectCategory 
}) {
  const sidebarCategories = [
    'Electronics',
    'Fashion',
    'Home & Kitchen',
    'Footwear',
    'Beauty',
  ];

  const categoryProducts = mockProducts.filter(
    (p) => p.category && p.category.toLowerCase() === categoryName.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 py-4">
        
        {/* Breadcrumb Line */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
          <button 
            onClick={onNavigateHome}
            className="hover:text-blue-600 transition"
          >
            Home
          </button>
          <ChevronRight size={12} className="text-gray-400" />
          <span className="text-gray-400">Categories</span>
          <ChevronRight size={12} className="text-gray-400" />
          <span className="text-gray-900 font-semibold capitalize">{categoryName}</span>
        </div>

        {/* 2-Column Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Sidebar */}
          <aside className="lg:col-span-3 bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Categories
            </h2>

            <nav className="space-y-1">
              {sidebarCategories.map((cat, idx) => {
                const isActive = cat.toLowerCase() === categoryName.toLowerCase();
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectCategory && onSelectCategory(cat.toLowerCase())}
                    className={`w-full text-left px-3 py-2 text-xs rounded-md transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Product Main Area */}
          <main className="lg:col-span-9">
            {/* Header Title */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-6">
              <h1 className="text-xl font-bold text-gray-900 capitalize">
                {categoryName}
              </h1>
              <span className="text-xs text-gray-500 font-medium">
                {categoryProducts.length} products
              </span>
            </div>

            {/* Product Grid */}
            {categoryProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {categoryProducts.map((product) => (
                  <ProductCard 
                    key={product._id} 
                    product={product} 
                    onSelectProduct={onSelectProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center my-4">
                <Layers size={24} className="text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No products found</p>
                <p className="text-xs text-gray-400 mt-1">There are no items currently in this category.</p>
              </div>
            )}
          </main>

        </div>
      </div>
    </div>
  );
}