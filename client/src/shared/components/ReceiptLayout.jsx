import ProductImage from '@/features/catalog/components/ProductImage';
import { formatMoney } from '@/shared/lib/formatMoney';

/**
 * The body of an order receipt: items, totals and the delivery address. Shared by the
 * "payment received" page and the order detail page so they can never disagree.
 *
 * @param {object} props
 * @param {object} props.order an order as mapped by checkoutService.getOrder
 * @param {string} [props.totalLabel] e.g. "Total paid" or "Total"
 */
export default function ReceiptLayout({ order, totalLabel = 'Total' }) {
  const { shipping } = order;
  return (
    <>
      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {order.items.map((item) => (
          <li
            key={`${item.productId}|${item.size ?? ''}|${item.color ?? ''}`}
            className="flex items-center justify-between gap-3 py-3 text-xs"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ProductImage
                src={item.imageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded border border-gray-100 bg-gray-50 object-contain p-1"
              />
              <div className="min-w-0">
                <span className="block truncate font-bold text-gray-900">{item.title}</span>
                <span className="text-[11px] text-gray-500">
                  {[item.color, item.size].filter(Boolean).join(' / ')}
                  {item.color || item.size ? ' · ' : ''}Qty {item.quantity}
                </span>
              </div>
            </div>
            <span className="font-bold text-gray-900">
              {formatMoney(item.lineTotalMinor, order.currency)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-gray-100 pt-4 text-xs">
        <div className="flex justify-between text-gray-500">
          <dt>Subtotal</dt>
          <dd className="font-bold text-gray-900">
            {formatMoney(order.subtotalMinor, order.currency)}
          </dd>
        </div>
        {order.discountMinor > 0 && (
          <div className="flex justify-between text-gray-500">
            <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
            <dd className="font-bold text-emerald-600">
              -{formatMoney(order.discountMinor, order.currency)}
            </dd>
          </div>
        )}
        <div className="flex justify-between text-gray-500">
          <dt>Delivery</dt>
          <dd className="font-bold text-gray-900">
            {order.deliveryFeeMinor === 0
              ? 'Free'
              : formatMoney(order.deliveryFeeMinor, order.currency)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-black text-gray-900">
          <dt>{totalLabel}</dt>
          <dd>{formatMoney(order.totalMinor, order.currency)}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl bg-gray-50 p-4 text-xs text-gray-600">
        <p className="mb-1 font-bold text-gray-900">Delivering to</p>
        <p>{shipping.name}</p>
        <p>{shipping.address}</p>
        <p>
          {shipping.city}, {shipping.state}
        </p>
        <p>{shipping.phone}</p>
      </div>
    </>
  );
}
