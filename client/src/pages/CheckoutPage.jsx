import { CreditCard, Lock, Tag, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useCart } from '../context/CartContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import ProductImage from '../features/catalog/components/ProductImage';
import {
  checkoutErrorMessage,
  couponMessage,
  isCartProblem,
  isCouponProblem,
} from '../features/checkout/lib/checkoutErrors';
import { estimateDeliveryFeeMinor } from '../features/checkout/lib/delivery';
import { loadShipping } from '../features/checkout/lib/shippingStorage';
import {
  redirectToCheckout,
  startCheckout,
  validateCoupon,
} from '../features/checkout/services/checkoutService';
import { formatMoney } from '../shared/lib/formatMoney';

/**
 * Step 2 of checkout: review, optional coupon, then pay on Stripe's secure page.
 * Nothing about money is decided here. The server prices the order from the database and the
 * amounts below are only a preview of that.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCart, subtotalMinor, isCartLoading, refetchCart, setIsCartOpen } = useCart();

  const [shipping] = useState(() => loadShipping(user?.id));
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, discountMinor, forSubtotalMinor }
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [cartProblem, setCartProblem] = useState(false); // stock or availability changed

  if (!shipping) return <Navigate to="/shipping" replace />;

  if (isCartLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 text-center font-sans text-xs text-gray-500">
        <p role="status">Loading your cart…</p>
      </div>
    );
  }

  if (selectedCart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
          <h1 className="text-lg font-black text-gray-900">Nothing to pay for</h1>
          <p className="mt-2 text-xs text-gray-500">
            No items are selected in your cart. Choose what you want to buy, then come back.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  const currency = selectedCart[0].currency;
  // A coupon preview belongs to the cart total it was checked against; if the cart changes, ask again.
  const activeCoupon = coupon && coupon.forSubtotalMinor === subtotalMinor ? coupon : null;
  const discountMinor = activeCoupon?.discountMinor ?? 0;
  const deliveryFeeMinor = estimateDeliveryFeeMinor(shipping.state);
  const estimatedTotalMinor = subtotalMinor - discountMinor + deliveryFeeMinor;
  const titleFor = (productId) => selectedCart.find((line) => line.productId === productId)?.title;

  const applyCoupon = async (event) => {
    event.preventDefault();
    const code = couponInput.trim();
    if (!code) return;
    setCouponError('');
    setCheckingCoupon(true);
    try {
      const result = await validateCoupon(code, subtotalMinor);
      if (result.ok) {
        setCoupon({
          code: result.code,
          discountMinor: result.discountMinor,
          forSubtotalMinor: subtotalMinor,
        });
        setCouponInput('');
      } else {
        setCoupon(null);
        setCouponError(
          couponMessage(result.reason, { minSubtotalMinor: result.minSubtotalMinor, currency }),
        );
      }
    } catch (error) {
      setCouponError(error.message);
    } finally {
      setCheckingCoupon(false);
    }
  };

  const pay = async () => {
    setPayError('');
    setCartProblem(false);
    setPaying(true);
    try {
      const { url } = await startCheckout({
        lines: selectedCart,
        shipping,
        couponCode: activeCoupon?.code ?? null,
      });
      redirectToCheckout(url); // the page unloads; "paying" stays on so nothing is clicked twice
    } catch (error) {
      setPayError(checkoutErrorMessage(error, { titleFor }));
      if (isCartProblem(error.code)) {
        setCartProblem(true);
        refetchCart(); // show the newest stock and prices
      }
      if (isCouponProblem(error.code)) setCoupon(null);
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
              ✓
            </span>
            <span>Shipping</span>
          </div>
          <div className="h-0.5 w-12 bg-emerald-600" />
          <div className="flex items-center gap-1.5 text-blue-600">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
              2
            </span>
            <span>Payment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left: shipping, coupon, payment note */}
          <div className="space-y-4 lg:col-span-7">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Truck size={16} className="text-blue-600" aria-hidden="true" /> Delivering to
                </h2>
                <Link to="/shipping" className="text-xs font-bold text-blue-600 hover:underline">
                  Edit
                </Link>
              </div>
              <p className="text-xs font-bold text-gray-900">{shipping.fullName}</p>
              <p className="text-xs text-gray-600">{shipping.address}</p>
              <p className="text-xs text-gray-600">
                {shipping.city}, {shipping.state}
              </p>
              <p className="text-xs text-gray-600">
                {shipping.phone} · {shipping.email}
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <h2 className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-3 text-sm font-bold text-gray-900">
                <Tag size={16} className="text-blue-600" aria-hidden="true" /> Coupon
              </h2>

              {activeCoupon ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <span>
                    <strong className="font-mono">{activeCoupon.code}</strong> applied:{' '}
                    {formatMoney(activeCoupon.discountMinor, currency)} off
                  </span>
                  <button
                    type="button"
                    onClick={() => setCoupon(null)}
                    className="cursor-pointer font-bold underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={applyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value)}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    maxLength={30}
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs uppercase focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={checkingCoupon || !couponInput.trim()}
                    className="cursor-pointer rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkingCoupon ? 'Checking…' : 'Apply'}
                  </button>
                </form>
              )}
              {coupon && !activeCoupon && (
                <p className="mt-2 text-[11px] text-amber-700">
                  Your cart changed, so please apply the coupon again.
                </p>
              )}
              {couponError && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                  {couponError}
                </p>
              )}
            </section>

            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[11px] font-medium text-blue-800">
              <Lock size={15} className="shrink-0 text-blue-600" aria-hidden="true" />
              <span>
                You will pay on Stripe&apos;s secure page. We never see or store your card details.
              </span>
            </div>
          </div>

          {/* Right: summary and Pay */}
          <div className="space-y-4 lg:col-span-5">
            <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <h2 className="border-b border-gray-100 pb-3 text-sm font-bold text-gray-900">
                Purchasing ({selectedCart.length} {selectedCart.length === 1 ? 'item' : 'items'})
              </h2>

              <ul className="max-h-60 space-y-3 overflow-y-auto pr-1">
                {selectedCart.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <ProductImage
                        src={item.image}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded border border-gray-100 bg-gray-50 object-contain p-1"
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-gray-900">{item.title}</span>
                        <span className="text-[11px] text-gray-500">
                          {item.variant ? `${item.variant} · ` : ''}Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatMoney(item.lineTotalMinor, item.currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-2 border-t border-gray-100 pt-4 text-xs">
                <div className="flex justify-between text-gray-500">
                  <dt>Subtotal</dt>
                  <dd className="font-bold text-gray-900">
                    {formatMoney(subtotalMinor, currency)}
                  </dd>
                </div>
                {discountMinor > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <dt>Discount ({activeCoupon.code})</dt>
                    <dd className="font-bold text-emerald-600">
                      -{formatMoney(discountMinor, currency)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <dt>Estimated delivery</dt>
                  <dd className="font-bold text-gray-900">
                    {deliveryFeeMinor === 0
                      ? `${formatMoney(0, currency)} (FREE)`
                      : formatMoney(deliveryFeeMinor, currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-black text-gray-900">
                  <dt>Estimated total</dt>
                  <dd className="text-base font-extrabold text-red-600">
                    {formatMoney(estimatedTotalMinor, currency)}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-gray-400">
                The final amount is confirmed on the payment page.
              </p>
            </section>

            {payError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {payError}{' '}
                {cartProblem && (
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(true)}
                    className="cursor-pointer font-bold underline"
                  >
                    Review cart
                  </button>
                )}
              </p>
            )}

            <button
              type="button"
              onClick={pay}
              disabled={paying}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard size={15} aria-hidden="true" />
              <span>
                {paying
                  ? 'Taking you to Stripe…'
                  : `Pay ${formatMoney(estimatedTotalMinor, currency)}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
