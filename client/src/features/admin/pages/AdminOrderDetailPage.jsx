import { ArrowLeft, Check, Circle, Copy, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { buildTimeline } from '@/features/orders/lib/orderStatus';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { formatDateTime } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';

import { isUuid } from '../../checkout/services/checkoutService';
import { NeedsRefundBadge, OrderStatusBadge } from '../components/OrderBadges';
import { useAdminOrder, useUpdateOrder } from '../hooks/useAdminOrders';
import {
  cancelReasonText,
  canEditTracking,
  nextStep,
  orderStatusInfo,
  PAYMENT_ISSUE_TOOLTIP,
  paymentIssueText,
  validateTracking,
} from '../lib/orderFlow';

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm';
const cardClass = 'rounded-xl border border-gray-200 bg-white p-4 shadow-xs';

function Shell({ children }) {
  return (
    <section className="space-y-4">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Orders
      </Link>
      {children}
    </section>
  );
}

function Timeline({ order }) {
  const steps = buildTimeline(order);
  return (
    <ol aria-label="Order status" className="space-y-3">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-3 text-xs">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              step.done ? 'bg-emerald-500 text-white' : 'border border-gray-300 text-gray-300'
            }`}
          >
            {step.done ? (
              <Check size={12} aria-hidden="true" />
            ) : (
              <Circle size={8} aria-hidden="true" />
            )}
          </span>
          <div>
            <p className={step.done ? 'font-bold text-gray-900' : 'text-gray-400'}>
              {step.label}
              <span className="sr-only">{step.done ? ' (done)' : ' (not yet)'}</span>
            </p>
            {step.done && step.at && (
              <p className="text-[11px] text-gray-500">{formatDateTime(step.at)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Copies a value and says so. If the browser refuses, it says that instead. */
function CopyButton({ value, label }) {
  const [state, setState] = useState('idle'); // idle | copied | failed
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
      >
        <Copy size={12} aria-hidden="true" /> Copy
      </button>
      <span role="status" className="text-xs font-semibold">
        {state === 'copied' && <span className="text-green-700">Copied!</span>}
        {state === 'failed' && (
          <span className="text-red-600">Could not copy. Select it by hand.</span>
        )}
      </span>
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-gray-500">{label}</dt>
      <dd className="text-sm break-words text-gray-900">
        {children || <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}

function TrackingForm({ order, update, onSaved }) {
  const [draft, setDraft] = useState(null); // null = untouched, show what is saved
  const [error, setError] = useState('');
  const saved = order.trackingNumber ?? '';
  const value = draft ?? saved;
  const problem = validateTracking(value);
  const unchanged = value.trim() === saved;

  const save = (event) => {
    event.preventDefault();
    if (problem || unchanged) return;
    setError('');
    update.mutate(
      { id: order.id, status: null, tracking: value.trim() },
      {
        onSuccess: (result) => {
          setDraft(null);
          onSaved(
            !result.changed
              ? `Nothing changed for order ${order.orderNumber}.`
              : result.trackingNumber
                ? `Tracking number saved for order ${order.orderNumber}.`
                : `Tracking number removed from order ${order.orderNumber}.`,
          );
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <form onSubmit={save} className="space-y-2" noValidate>
      <label htmlFor="tracking" className="block text-sm font-bold text-gray-900">
        Tracking number
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="tracking"
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby="tracking-help"
          className={`${inputClass} max-w-xs`}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={update.isPending || Boolean(problem) || unchanged}
          className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {update.isPending ? 'Saving...' : 'Save tracking'}
        </button>
      </div>
      <p id="tracking-help" className="text-xs text-gray-500">
        Optional. Leave it empty and save to remove it. Up to 100 characters.
      </p>
      {problem && (
        <p role="alert" className="text-xs text-red-600">
          {problem}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}

/** One order for an admin: payment problems, timeline, actions, customer, items and payment. */
export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const query = useAdminOrder(id);
  const update = useUpdateOrder();
  const order = query.data;

  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null); // 'ship' | 'deliver' | null
  const [dialogError, setDialogError] = useState('');
  const [shipTracking, setShipTracking] = useState('');

  // Stable on purpose: the dialog re-focuses its Cancel button whenever onCancel changes.
  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogError('');
    setShipTracking('');
  }, []);

  if (!isUuid(id) || order === null) {
    return (
      <Shell>
        <div className={`${cardClass} text-center`}>
          <h2 className="text-base font-black text-gray-900">We couldn&apos;t find that order</h2>
          <p className="mt-1 text-xs text-gray-500">
            It may have been removed or the link is wrong.
          </p>
        </div>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-bold text-red-700">We couldn&apos;t load this order.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-3 cursor-pointer rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }
  if (!order) {
    return (
      <Shell>
        <p role="status" className="py-12 text-center text-xs text-gray-500">
          Loading the order…
        </p>
      </Shell>
    );
  }

  const step = nextStep(order.status);
  const issue = paymentIssueText(order.paymentIssue);
  const cancelReason = cancelReasonText(order.cancelReason);

  const confirmStep = () => {
    if (!step) return;
    const trackingProblem = dialog === 'ship' ? validateTracking(shipTracking) : '';
    if (trackingProblem) {
      setDialogError(trackingProblem);
      return;
    }
    setDialogError('');
    update.mutate(
      {
        id: order.id,
        status: step.status,
        tracking: dialog === 'ship' && shipTracking.trim() ? shipTracking.trim() : null,
      },
      {
        onSuccess: (result) => {
          closeDialog();
          setNotice(
            result.changed
              ? `Order ${order.orderNumber} marked as ${step.status}.`
              : `Nothing changed: order ${order.orderNumber} is already ${orderStatusInfo(result.status).label.toLowerCase()}.`,
          );
        },
        onError: (err) => setDialogError(err.message),
      },
    );
  };

  return (
    <Shell>
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800"
        >
          {notice}
        </p>
      )}

      {issue && (
        <div
          role="alert"
          title={PAYMENT_ISSUE_TOOLTIP}
          className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-black">Needs refund</p>
            <p>{issue}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-gray-900">Order {order.orderNumber}</h2>
          <p className="text-xs text-gray-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.paymentIssue && <NeedsRefundBadge />}
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {order.status === 'cancelled' && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
          Cancelled on {formatDateTime(order.cancelledAt)}
          {cancelReason ? ` (${cancelReason})` : ''}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Status</h3>
            <Timeline order={order} />
          </section>

          <section className={`${cardClass} space-y-4`}>
            <h3 className="text-sm font-bold text-gray-900">Actions</h3>
            {step && (
              <button
                type="button"
                onClick={() => {
                  setNotice('');
                  setDialog(step.status === 'shipped' ? 'ship' : 'deliver');
                }}
                className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                {step.button}
              </button>
            )}
            {order.status === 'pending_payment' && (
              <p className="text-sm text-gray-600">
                Waiting for the customer to pay. There is nothing to do yet.
              </p>
            )}
            {order.status === 'delivered' && (
              <p className="text-sm text-gray-600">This order was delivered. No further steps.</p>
            )}
            {order.status === 'cancelled' && (
              <p className="text-sm text-gray-600">
                This order is cancelled. It cannot be changed.
              </p>
            )}
            {canEditTracking(order.status) && (
              <TrackingForm order={order} update={update} onSaved={setNotice} />
            )}
          </section>

          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Items</h3>
            <ul className="divide-y divide-gray-100">
              {order.items.map((item, index) => (
                <li key={`${item.productId}-${index}`} className="flex items-center gap-3 py-2.5">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {[item.size, item.color].filter(Boolean).join(' · ')}
                      {item.size || item.color ? ' · ' : ''}
                      {item.quantity} × {formatMoney(item.unitPriceMinor, order.currency)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatMoney(item.lineTotalMinor, order.currency)}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <dt>Subtotal</dt>
                <dd>{formatMoney(order.subtotalMinor, order.currency)}</dd>
              </div>
              {order.discountMinor > 0 && (
                <div className="flex justify-between text-gray-600">
                  <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                  <dd>−{formatMoney(order.discountMinor, order.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <dt>Delivery</dt>
                <dd>{formatMoney(order.deliveryFeeMinor, order.currency)}</dd>
              </div>
              <div className="flex justify-between font-black text-gray-900">
                <dt>Total</dt>
                <dd>{formatMoney(order.totalMinor, order.currency)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="space-y-4">
          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Customer and delivery</h3>
            <dl className="space-y-2">
              <Field label="Name">{order.shipping.name}</Field>
              <Field label="Email on the order">{order.shipping.email}</Field>
              <Field label="Account email">{order.accountEmail}</Field>
              <Field label="Phone">{order.shipping.phone}</Field>
              <Field label="Address">
                {[order.shipping.address, order.shipping.city, order.shipping.state]
                  .filter(Boolean)
                  .join(', ')}
              </Field>
              <Field label="Courier">{order.shipping.courier}</Field>
              <Field label="Notes from the customer">{order.shipping.notes}</Field>
            </dl>
          </section>

          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Payment</h3>
            <dl className="space-y-2">
              <Field label="Paid at">{formatDateTime(order.paidAt)}</Field>
              <div>
                <dt className="text-[11px] font-semibold text-gray-500">
                  Stripe Payment Intent (for refunds)
                </dt>
                <dd className="mt-1 space-y-1.5">
                  {order.stripePaymentIntentId ? (
                    <>
                      <code className="block text-xs break-all text-gray-900">
                        {order.stripePaymentIntentId}
                      </code>
                      <CopyButton
                        value={order.stripePaymentIntentId}
                        label="the Stripe payment intent"
                      />
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Not available (not paid yet)</span>
                  )}
                </dd>
              </div>
              {order.stripeSessionId && (
                <Field label="Stripe Checkout Session">
                  <code className="text-xs break-all">{order.stripeSessionId}</code>
                </Field>
              )}
            </dl>
          </section>
        </div>
      </div>

      {dialog && step && (
        <ConfirmDialog
          title={step.button}
          confirmLabel={step.button}
          busy={update.isPending}
          onConfirm={confirmStep}
          onCancel={closeDialog}
        >
          <p>
            {dialog === 'ship'
              ? `Mark order ${order.orderNumber} as shipped? It cannot be moved back.`
              : `Mark order ${order.orderNumber} as delivered? It cannot be moved back.`}
          </p>
          {dialog === 'ship' && (
            <div className="mt-3">
              <label htmlFor="ship-tracking" className="block text-xs font-semibold text-gray-700">
                Tracking number (optional)
              </label>
              <input
                id="ship-tracking"
                value={shipTracking}
                onChange={(event) => setShipTracking(event.target.value)}
                className={`${inputClass} mt-1`}
                autoComplete="off"
              />
            </div>
          )}
          {dialogError && (
            <p role="alert" className="mt-3 text-xs font-semibold text-red-600">
              {dialogError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </Shell>
  );
}
