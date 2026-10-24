import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { selectedCart, totalPrice, removeSelectedItems } = useCart();

  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isCompleted, setIsCompleted] = useState(false);

  const [cardData, setCardData] = useState({
    number: '4242 •••• •••• 4242',
    expiry: '08/28',
    cvc: '123',
    name: 'Huzaifa Javid',
  });

  const handlePlaceOrder = (e) => {
    e.preventDefault();

    if (selectedCart.length === 0) {
      alert('No items selected for checkout.');
      return;
    }

    // BACKEND INTEGRATION NOTE:
    // Send `selectedCart` items and shipping data to your friend's API endpoint here:
    // await fetch(`${import.meta.env.VITE_API_BASE_URL}/orders`, { method: 'POST', body: JSON.stringify({ items: selectedCart, ... }) });

    // Remove only the purchased items, leaving unselected items in the cart
    removeSelectedItems();
    setIsCompleted(true);
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900">Order Placed Successfully!</h2>
          <p className="text-xs text-gray-500 mt-2 mb-6">
            Thank you for shopping with ShopYaro. Your items are being prepared for shipping. Any unselected cart items remain saved in your cart.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Progress Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">✓</span>
            <span>Shipping</span>
          </div>
          <div className="w-12 h-0.5 bg-emerald-600" />
          <div className="flex items-center gap-1.5 text-blue-600">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">2</span>
            <span>Payment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Payment Details Form */}
          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100 mb-6">
              <CreditCard size={20} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Select Payment Method</h2>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-xl border text-left transition ${
                    paymentMethod === 'card' ? 'border-blue-600 bg-blue-50/30' : 'border-gray-200'
                  }`}
                >
                  <CreditCard size={18} className="text-blue-600 mb-2" />
                  <span className="text-xs font-bold text-gray-900 block">Credit / Debit Card</span>
                  <span className="text-[11px] text-gray-500">Visa, Mastercard, AMEX</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 rounded-xl border text-left transition ${
                    paymentMethod === 'cod' ? 'border-blue-600 bg-blue-50/30' : 'border-gray-200'
                  }`}
                >
                  <ShieldCheck size={18} className="text-orange-500 mb-2" />
                  <span className="text-xs font-bold text-gray-900 block">Cash on Delivery</span>
                  <span className="text-[11px] text-gray-500">Pay on arrival</span>
                </button>
              </div>

              {paymentMethod === 'card' && (
                <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Card Number</label>
                    <input
                      type="text"
                      required
                      value={cardData.number}
                      onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={cardData.expiry}
                        onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">CVC / CVV</label>
                      <input
                        type="text"
                        required
                        value={cardData.cvc}
                        onChange={(e) => setCardData({ ...cardData, cvc: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 mt-6"
              >
                <Lock size={14} /> Place Secure Order (${totalPrice.toFixed(2)})
              </button>
            </form>
          </div>

          {/* Selected Order Items Summary */}
          <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-3 border-b border-gray-100">
              Purchasing ({selectedCart.length} items)
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
              {selectedCart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <img 
                      src={item.images?.[0] || item.image} 
                      alt="" 
                      className="w-10 h-10 object-contain rounded border border-gray-100 p-1 bg-gray-50" 
                    />
                    <div>
                      <span className="font-bold text-gray-900 truncate block max-w-[150px]">{item.title || item.name}</span>
                      <span className="text-gray-500 text-[11px]">Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Selected Items Total</span>
                <span className="font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Express Shipping</span>
                <span className="font-bold text-emerald-600">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-black text-gray-900 pt-3 border-t border-gray-100">
                <span>Total Amount</span>
                <span className="text-blue-600">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}