import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ProductImage from '../features/catalog/components/ProductImage';
import { STANDARD_DELIVERY_FEE_MINOR } from '../shared/constants/market';
import { formatMoney } from '../shared/lib/formatMoney';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCart, subtotalMinor, removeSelectedItems } = useCart();

  // Retrieve shipping state from router or localStorage fallback
  const [shippingData, setShippingData] = useState(() => {
    return location.state?.shippingData || JSON.parse(localStorage.getItem('shopyaro_shipping') || '{}');
  });

  useEffect(() => {
    if (location.state?.shippingData) {
      localStorage.setItem('shopyaro_shipping', JSON.stringify(location.state.shippingData));
    }
  }, [location.state]);

  const stateName = shippingData.state || '';
  const isBauchiState = stateName.toLowerCase().includes('bauchi');

  const [paymentMethod, setPaymentMethod] = useState('paystack');
  const [isCompleted, setIsCompleted] = useState(false);

  const deliveryFeeMinor =
    shippingData.deliveryFeeMinor ?? (isBauchiState ? 0 : STANDARD_DELIVERY_FEE_MINOR);
  const grandTotalMinor = subtotalMinor + deliveryFeeMinor;

  const handlePlaceOrder = (e) => {
    e.preventDefault();

    if (selectedCart.length === 0) {
      alert('No items selected for checkout.');
      return;
    }

    removeSelectedItems();
    setIsCompleted(true);
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900">Order Placed Successfully!</h2>
          <p className="text-xs text-gray-500 mt-2 mb-6">
            Thank you for shopping with ShopYaro. Your items are being prepared for shipping.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
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

            <form onSubmit={handlePlaceOrder} id="checkout-form" className="space-y-4">
              <div className="space-y-3 mb-6">
                
                {/* Paystack Payment Gateway */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paystack')}
                  className={`w-full p-4 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    paymentMethod === 'paystack' ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      name="paymentMethodRadio" 
                      checked={paymentMethod === 'paystack'} 
                      onChange={() => setPaymentMethod('paystack')}
                      className="mt-0.5 text-blue-600" 
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">Paystack Payment Gateway</span>
                        <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wide">LIVE INSTANT</span>
                      </div>
                      <span className="text-[11px] text-gray-500 block mt-0.5">Mastercard, Visa, Verve, USSD & Bank Transfer</span>
                    </div>
                  </div>
                  <CreditCard size={18} className="text-blue-600 shrink-0" />
                </button>

                {/* Squad by GTCO */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('squad')}
                  className={`w-full p-4 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    paymentMethod === 'squad' ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      name="paymentMethodRadio" 
                      checked={paymentMethod === 'squad'} 
                      onChange={() => setPaymentMethod('squad')}
                      className="mt-0.5 text-blue-600" 
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">Squad by GTCO (HabariPay)</span>
                        <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wide">LIVE INSTANT</span>
                      </div>
                      <span className="text-[11px] text-gray-500 block mt-0.5">Virtual Accounts, USSD (*737#), Cards & Transfer</span>
                    </div>
                  </div>
                </button>

                {/* Cash on Delivery (Dynamically Unlocked if Bauchi) */}
                <button
                  type="button"
                  disabled={!isBauchiState}
                  onClick={() => isBauchiState && setPaymentMethod('cod')}
                  className={`w-full p-4 rounded-xl border text-left transition flex items-center justify-between ${
                    !isBauchiState 
                      ? 'opacity-50 bg-gray-50 border-gray-200 cursor-not-allowed' 
                      : paymentMethod === 'cod' 
                        ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600 cursor-pointer' 
                        : 'border-gray-200 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      name="paymentMethodRadio" 
                      disabled={!isBauchiState}
                      checked={paymentMethod === 'cod'} 
                      onChange={() => isBauchiState && setPaymentMethod('cod')}
                      className="mt-0.5 text-blue-600" 
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">Cash on Delivery</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wide border ${
                          isBauchiState 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {isBauchiState ? 'Bauchi Only' : 'Available for Bauchi Only'}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500 block mt-0.5">
                        {isBauchiState ? 'Pay on doorstep delivery in Bauchi' : 'Not available for your selected state'}
                      </span>
                    </div>
                  </div>
                  <ShieldCheck size={18} className="text-orange-500 shrink-0" />
                </button>

              </div>

              {/* Security Badge */}
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-2 text-[11px] text-blue-800 font-medium">
                <ShieldCheck size={15} className="text-blue-600 shrink-0" />
                <span>256-Bit SSL Encrypted • Fast & Secured Checkout Gateways</span>
              </div>
            </form>
          </div>

          {/* Selected Order Items Summary & Dynamic Action Button */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 pb-3 border-b border-gray-100">
                Purchasing ({selectedCart.length} items)
              </h3>

              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {selectedCart.map((item) => (
                  <div key={item.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <ProductImage src={item.image} alt="" className="w-10 h-10 object-contain rounded border border-gray-100 p-1 bg-gray-50" />
                      <div>
                        <span className="font-bold text-gray-900 truncate block max-w-[150px]">{item.title || item.name}</span>
                        <span className="text-gray-500 text-[11px]">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900">{formatMoney(item.lineTotalMinor, item.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Selected Items Total</span>
                  <span className="font-bold text-gray-900">{formatMoney(subtotalMinor)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Delivery Fee</span>
                  <span className={`font-bold ${isBauchiState ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {deliveryFeeMinor === 0 ? `${formatMoney(0)} (FREE)` : formatMoney(deliveryFeeMinor)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-gray-900 pt-3 border-t border-gray-100">
                  <span>Total Amount</span>
                  <span className="text-red-600 font-extrabold text-base">{formatMoney(grandTotalMinor)}</span>
                </div>
              </div>
            </div>

            {/* Dynamic Action Button Placed Below Order Summary */}
            <button
              type="submit"
              form="checkout-form"
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {paymentMethod === 'paystack' && (
                <>
                  <CreditCard size={15} />
                  <span>Pay with Paystack ({formatMoney(grandTotalMinor)})</span>
                </>
              )}
              {paymentMethod === 'squad' && (
                <>
                  <CreditCard size={15} />
                  <span>Pay with Squad by GTCO ({formatMoney(grandTotalMinor)})</span>
                </>
              )}
              {paymentMethod === 'cod' && (
                <>
                  <ShieldCheck size={15} />
                  <span>Confirm Cash on Delivery ({formatMoney(grandTotalMinor)})</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}