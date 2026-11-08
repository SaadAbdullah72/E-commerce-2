import { ShoppingCart, Star } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import ProductImage from '../../features/catalog/components/ProductImage';
import { formatMoney } from '../../shared/lib/formatMoney';

export default function ProductCard({ product, onSelectProduct }) {
  const { addToCart } = useCart();

  return (
    <div className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between">
      {/* Clickable Image & Title Area */}
      <div onClick={() => onSelectProduct && onSelectProduct(product)} className="cursor-pointer">
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <ProductImage
            src={product.images?.[0]}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {product.discountPercent > 0 && (
            <div className="absolute top-2 left-2 bg-orange-500 text-white font-black text-[10px] px-2 py-0.5 rounded shadow">
              -{product.discountPercent}%
            </div>
          )}
        </div>

        <div className="p-3">
          <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
            {product.title}
          </h3>

          {product.reviewsCount > 0 && (
            <div className="flex items-center gap-1 mt-1 text-amber-500">
              <Star size={11} className="fill-amber-400" />
              <span className="text-[11px] font-bold text-gray-700">{product.ratings}</span>
              <span className="text-[10px] text-gray-400">({product.reviewsCount})</span>
            </div>
          )}
        </div>
      </div>

      {/* Price & Cart Action */}
      <div className="p-3 pt-0 flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-base font-black text-blue-700">
            {formatMoney(product.priceMinor, product.currency)}
          </span>
          {product.compareAtPriceMinor > product.priceMinor && (
            <span className="text-[11px] text-gray-400 line-through">
              {formatMoney(product.compareAtPriceMinor, product.currency)}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevents opening detail page when clicking Add to Cart
            addToCart(product);
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg shadow transition active:scale-95"
          title="Add to Cart"
          aria-label={`Add ${product.title} to cart`}
        >
          <ShoppingCart size={15} />
        </button>
      </div>
    </div>
  );
}
