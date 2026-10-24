import React, { useEffect } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, CheckSquare, Square } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function CartDrawer({ onCheckout }) {
  const {
    cart,
    selectedCart,
    isCartOpen,
    setIsCartOpen,
    toggleSelectItem,
    toggleSelectAll,
    removeFromCart,
    updateQuantity,
    totalPrice,
    totalItems,
    selectedItemsCount,
  } = useCart();

  // Prevent background page body scroll while drawer is open (prevents layout shift)
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

  const isAllSelected = cart.length > 0 && cart.every((item) => item.selected);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Blurred & Dimmed Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out cursor-pointer"
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-md bg-white border-l border-gray-200 shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Your Cart</h2>
              <span className="text-xs text-gray-500 font-medium">({totalItems} items)</span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Select All Bar */}
          {cart.length > 0 && (
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
                <span>Select All ({cart.length})</span>
              </button>
              <span className="text-[11px] text-gray-500">
                {selectedItemsCount} selected for checkout
              </span>
            </div>
          )}

          {/* Cart Items List (Prevent Layout Shifts) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar">
            {cart.length > 0 ? (
              cart.map((item, idx) => {
                const itemUnitPrice = Number(item.price) || 0;
                const itemLineTotal = itemUnitPrice * item.quantity;

                return (
                  <div
                    key={`${item._id}-${item.variant || idx}`}
                    className={`flex items-start gap-3 pb-4 border-b border-gray-100 last:border-b-0 transition-opacity duration-200 ${
                      !item.selected ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Item Selection Checkbox */}
                    <button
                      onClick={() => toggleSelectItem(item._id, item.variant)}
                      className="mt-5 text-gray-400 hover:text-blue-600 transition cursor-pointer shrink-0"
                    >
                      {item.selected ? (
                        <CheckSquare size={18} className="text-blue-600" />
                      ) : (
                        <Square size={18} className="text-gray-300" />
                      )}
                    </button>

                    {/* Thumbnail */}
                    <div className="w-16 h-16 bg-gray-50 rounded-md border border-gray-200 shrink-0 p-1 flex items-center justify-center">
                      <img
                        src={item.images?.[0] || item.image || 'https://via.placeholder.com/150'}
                        alt={item.title || item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-gray-900 truncate">
                            {item.title || item.name}
                          </h3>
                          {item.variant && (
                            <span className="text-[11px] text-gray-500 block">
                              Variant: {item.variant}
                            </span>
                          )}
                          <span className="text-xs font-medium text-gray-500 block mt-0.5">
                            ${itemUnitPrice.toFixed(2)} each
                          </span>
                        </div>

                        <button
                          onClick={() => removeFromCart(item._id, item.variant)}
                          className="text-gray-400 hover:text-red-500 transition p-0.5 cursor-pointer shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-gray-200 rounded bg-gray-50 shrink-0">
                          <button
                            onClick={() => updateQuantity(item._id, item.variant, -1)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item._id, item.variant, 1)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="text-xs font-black text-gray-900 shrink-0">
                          ${itemLineTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <ShoppingBag size={32} className="text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-700">Your cart is empty</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Explore deals and add products to start shopping.</p>
              </div>
            )}
          </div>

          {/* Footer & Checkout Action */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 backdrop-blur-xs space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                <span>Selected Subtotal ({selectedItemsCount} items)</span>
                <span className="text-sm font-black text-blue-600">${totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-gray-400">Shipping and taxes calculated at checkout.</p>

              <button
                disabled={selectedCart.length === 0}
                onClick={() => {
                  setIsCartOpen(false);
                  if (onCheckout) onCheckout();
                }}
                className={`w-full py-2.5 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs ${
                  selectedCart.length > 0
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