import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingCart, Heart, Star, ChevronRight, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ProductReviewsSection from '../components/product/ProductReviewsSection';
import { CatalogEmpty, CatalogError } from '../features/catalog/components/CatalogStates';
import ProductImage from '../features/catalog/components/ProductImage';
import { useProduct } from '../features/catalog/hooks/useCatalog';
import { maxQuantityFor } from '../features/cart/lib/cartMath';
import { formatMoney } from '../shared/lib/formatMoney';

/** Loads the product named in the URL (/product/:slug), then shows it. */
export default function ProductDetailPage({ isLoggedIn }) {
  const { slug } = useParams();
  const { data: product, isPending, isError, refetch } = useProduct(slug);

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div
            role="status"
            aria-label="Loading product"
            className="grid animate-pulse grid-cols-1 gap-6 rounded-2xl border border-gray-100 bg-white p-6 lg:grid-cols-12"
          >
            <div className="aspect-square rounded-xl bg-gray-100 lg:col-span-6" />
            <div className="space-y-3 lg:col-span-6">
              <div className="h-4 w-1/4 rounded bg-gray-100" />
              <div className="h-6 w-3/4 rounded bg-gray-100" />
              <div className="h-8 w-1/3 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <CatalogError message="We could not load this product." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <CatalogEmpty
            title="Product not found"
            text="This product does not exist or is no longer available."
          />
          <p className="mt-4 text-center text-xs">
            <Link to="/" className="font-bold text-blue-600 hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // key: switching to another product starts with fresh selections
  return <ProductDetailView key={product.id} product={product} isLoggedIn={isLoggedIn} />;
}

function ProductDetailView({ product, isLoggedIn }) {
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();

  const productImages = product.images;
  const sizes = product.sizes;
  const colors = product.colors;

  const [selectedImage, setSelectedImage] = useState(productImages[0] ?? null);
  const [selectedSize, setSelectedSize] = useState(sizes[0] ?? '');
  const [selectedColor, setSelectedColor] = useState(colors[0]?.name ?? '');
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const discountPercent = product.discountPercent;
  const maxQuantity = maxQuantityFor(product.stock);
  const inStock = maxQuantity > 0;

  const handleAddToCart = () => {
    if (!inStock) return;
    addToCart(product, quantity, { size: selectedSize, color: selectedColor });
    setIsCartOpen(true);
  };

  const handleBuyNow = () => {
    if (!inStock) return;
    handleAddToCart();
    navigate(isLoggedIn ? '/shipping' : '/login?redirect=shipping');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-4">
        
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-blue-600 transition cursor-pointer">
            Home
          </button>
          <ChevronRight size={12} />
          <span className="capitalize">{product.category || 'Deals'}</span>
          <ChevronRight size={12} />
          <span className="text-gray-900 truncate max-w-xs">{product.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
          
          {/* Dynamic Image Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-square bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex items-center justify-center p-4">
              <ProductImage
                src={selectedImage}
                alt={product.title}
                className="w-full h-full object-contain"
              />
              {discountPercent > 0 && (
                <span className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  -{discountPercent}% OFF
                </span>
              )}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="absolute top-3 right-3 p-2 bg-white/90 border border-gray-100 rounded-full text-gray-500 hover:text-red-500 transition cursor-pointer"
              >
                <Heart size={18} className={isWishlisted ? 'fill-red-500 text-red-500' : ''} />
              </button>
            </div>

            {/* Dynamic Thumbnails Row (Only shows if Admin provided multiple images) */}
            {productImages.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-lg border p-1 bg-gray-50 flex items-center justify-center transition cursor-pointer shrink-0 ${
                      selectedImage === img ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-gray-200'
                    }`}
                  >
                    <ProductImage src={img} alt={`${product.title} - image ${idx + 1}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Admin Variant Controls */}
          <div className="lg:col-span-6 space-y-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {product.category || 'Item'}
              </span>
              <h1 className="text-lg sm:text-xl font-black text-gray-900 mt-2">
                {product.title}
              </h1>

              <div className="flex items-center space-x-2 mt-2 text-xs">
                {product.reviewsCount > 0 ? (
                  <>
                    <div className="flex items-center text-amber-500 font-bold">
                      <Star size={14} className="fill-amber-400 text-amber-400 mr-1" />
                      <span>{product.ratings}</span>
                    </div>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500 font-medium">{product.reviewsCount} Reviews</span>
                  </>
                ) : (
                  <span className="text-gray-500 font-medium">No reviews yet</span>
                )}
              </div>
            </div>

            {/* Price Box */}
            <div className="p-3 bg-gray-50 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-gray-900">
                {formatMoney(product.priceMinor, product.currency)}
              </span>
              {product.compareAtPriceMinor > product.priceMinor && (
                <span className="text-xs font-medium text-gray-400 line-through">
                  {formatMoney(product.compareAtPriceMinor, product.currency)}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {product.description || 'No description provided.'}
            </p>

            {/* Dynamic Admin Variants Section */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              
              {/* Dynamic Color Selector */}
              {colors.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Color: <span className="text-gray-900">{selectedColor}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((colorObj, idx) => {
                      const colorName = typeof colorObj === 'string' ? colorObj : colorObj.name;
                      const colorHex = typeof colorObj === 'object' ? colorObj.hex : '#111827';

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedColor(colorName)}
                          className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold transition cursor-pointer ${
                            selectedColor === colorName
                              ? 'border-blue-600 bg-blue-50 text-blue-600'
                              : 'border-gray-200 text-gray-700'
                          }`}
                        >
                          {colorHex && (
                            <span 
                              className="w-3 h-3 rounded-full border border-gray-300 shrink-0" 
                              style={{ backgroundColor: colorHex }} 
                            />
                          )}
                          <span>{colorName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Size / Option Selector */}
              {sizes.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Size / Option: <span className="text-gray-900">{selectedSize}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSize(size)}
                        className={`px-3 py-1 border rounded-lg text-xs font-bold transition cursor-pointer ${
                          selectedSize === size
                            ? 'border-blue-600 bg-blue-50 text-blue-600'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!inStock && (
                <p role="status" className="text-xs font-bold text-red-600">
                  Out of stock
                </p>
              )}

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Quantity</label>
                <div className="flex items-center w-28 border border-gray-200 rounded-lg bg-gray-50">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="px-2 py-1 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="flex-1 text-center text-xs font-bold text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    disabled={quantity >= maxQuantity}
                    aria-label="Increase quantity"
                    className="px-2 py-1 text-gray-600 hover:bg-gray-200 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleAddToCart}
                disabled={!inStock}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <ShoppingCart size={15} /> Add to Cart
              </button>

              <button
                onClick={handleBuyNow}
                disabled={!inStock}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Buy Now
              </button>
            </div>
            
          </div>
        </div>

<ProductReviewsSection productId={product._id} isLoggedIn={isLoggedIn} />

      </div>
    </div>
  );
}