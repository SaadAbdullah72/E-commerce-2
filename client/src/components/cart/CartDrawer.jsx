import { useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import ProductImage from '../../features/catalog/components/ProductImage';
import { formatMoney } from '../../shared/lib/formatMoney';

const PROBLEM_TEXT = {
  unavailable: 'No longer available. Remove it to continue.',
  out_of_stock: 'Out of stock. Remove it or check back later.',
  error: "We couldn't check this item. Try again.",
};

export default function CartDrawer({ onCheckout }) {
  const {
    cart,
    selectedCart,
    isCartOpen,
    setIsCartOpen,
    isCartLoading,
    isCartError,
    refetchCart,
    toggleSelectItem,
    toggleSelectAll,
    removeFromCart,
    updateQuantity,
    acknowledgePriceChange,
    subtotalMinor,
    totalItems,
    selectedItemsCount,
  } = useCart();

  // Prevent background page body scroll while drawer is open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const buyable = cart.filter((line) => line.status === 'ok');
  const isAllSelected = buyable.length > 0 && buyable.every((line) => line.selected);
  const canCheckout = selectedCart.length > 0 && !isCartLoading && !isCartError;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Blurred & Dimmed Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div
          role="dialog"
          aria-label="Your cart"
          className="w-full sm:w-md sm:max-w-md bg-white border-l border-gray-200 shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Your Cart</h2>
              <span className="text-xs text-gray-500 font-medium">({totalItems} items)</span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              aria-label="Close cart"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {isCartError && (
            <div role="alert" className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center justify-between gap-2">
              <span>We couldn&apos;t load the latest prices.</span>
              <button
                onClick={() => refetchCart()}
                className="font-bold underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Select All Bar */}
          {buyable.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-xs shrink-0">
              <button
                onClick={() => toggleSelectAll(!isAllSelected)}
                className="flex items-center gap-2 text-gray-700 font-semibold hover:text-blue-600 transition cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} className="text-gray-400" />
                )}
                <span>Select All ({buyable.length})</span>
              </button>
              <span className="text-[11px] text-gray-500">
                {selectedItemsCount} selected for checkout
              </span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 overscroll-contain">
            {cart.length > 0 ? (
              cart.map((line) => {
                const isBuyable = line.status === 'ok';
                const isPending = line.status === 'loading';

                if (isPending) {
                  return (
                    <div
                      key={line.key}
                      role="status"
                      aria-label="Loading cart item"
                      className="flex animate-pulse items-center gap-3 pb-4"
                    >
                      <div className="h-16 w-16 rounded-md bg-gray-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 rounded bg-gray-100" />
                        <div className="h-3 w-1/3 rounded bg-gray-100" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={line.key}
                    className={`flex items-start gap-3 pb-4 border-b border-gray-100 last:border-b-0 transition-opacity duration-200 ${
                      !line.selected || !isBuyable ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Item Selection Checkbox */}
                    <button
                      onClick={() => toggleSelectItem(line.key)}
                      disabled={!isBuyable}
                      aria-label={line.selected ? 'Deselect item' : 'Select item'}
                      className="mt-4 p-1 text-gray-400 hover:text-blue-600 transition cursor-pointer shrink-0 disabled:cursor-not-allowed"
                    >
                      {line.selected && isBuyable ? (
                        <CheckSquare size={18} className="text-blue-600" />
                      ) : (
                        <Square size={18} className="text-gray-300" />
                      )}
                    </button>

                    {/* Thumbnail */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-md border border-gray-200 shrink-0 p-1 flex items-center justify-center overflow-hidden">
                      <ProductImage
                        src={line.image}
                        alt={line.title ?? 'Product'}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-gray-900 truncate">
                            {line.title ?? 'Unavailable item'}
                          </h3>
                          {line.variant && (
                            <span className="text-[11px] text-gray-500 block">
                              Variant: {line.variant}
                            </span>
                          )}
                          {isBuyable && (
                            <span className="text-xs font-medium text-gray-500 block mt-0.5">
                              {formatMoney(line.unitPriceMinor, line.currency)} each
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromCart(line.key)}
                          aria-label="Remove item"
                          className="text-gray-400 hover:text-red-500 transition p-1 cursor-pointer shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {!isBuyable && (
                        <p role="alert" className="mt-1 flex items-start gap-1 text-[11px] font-medium text-red-600">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                          {PROBLEM_TEXT[line.status]}
                        </p>
                      )}

                      {isBuyable && line.priceChanged && (
                        <p role="status" className="mt-1 text-[11px] font-medium text-amber-700">
                          Price changed from {formatMoney(line.previousPriceMinor, line.currency)}.{' '}
                          <button
                            onClick={() => acknowledgePriceChange(line.key)}
                            className="font-bold underline cursor-pointer"
                          >
                            OK
                          </button>
                        </p>
                      )}

                      {isBuyable && line.quantityReduced && (
                        <p role="status" className="mt-1 text-[11px] font-medium text-amber-700">
                          Only {line.maxQuantity} available.
                        </p>
                      )}

                      {isBuyable && (
                        <div className="flex items-center justify-between mt-3">
                          {/* Quantity Controls */}
                          <div className="flex items-center border border-gray-200 rounded bg-gray-50 shrink-0">
                            <button
                              onClick={() => updateQuantity(line.key, -1)}
                              disabled={line.quantity <= 1}
                              aria-label="Decrease quantity"
                              className="p-1.5 sm:px-2 text-gray-600 hover:bg-gray-200 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-2.5 text-xs font-bold text-gray-900" aria-live="polite">
                              {line.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(line.key, 1)}
                              disabled={line.quantity >= line.maxQuantity}
                              aria-label="Increase quantity"
                              className="p-1.5 sm:px-2 text-gray-600 hover:bg-gray-200 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          {/* Line Total */}
                          <span className="text-xs font-black text-gray-900 shrink-0">
                            {formatMoney(line.lineTotalMinor, line.currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <ShoppingBag size={32} className="text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-700">Your cart is empty</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Explore deals and add products to start shopping.
                </p>
              </div>
            )}
          </div>

          {/* Footer & Checkout Action */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 backdrop-blur-xs space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                <span>Selected Subtotal ({selectedItemsCount} items)</span>
                <span className="text-sm font-black text-blue-600">{formatMoney(subtotalMinor)}</span>
              </div>
              <p className="text-[10px] text-gray-400">Shipping and taxes calculated at checkout.</p>

              <button
                disabled={!canCheckout}
                onClick={() => {
                  setIsCartOpen(false);
                  if (onCheckout) onCheckout();
                }}
                className={`w-full py-3 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs ${
                  canCheckout
                    ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer active:scale-[0.99]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Proceed to Checkout ({selectedItemsCount}) <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
