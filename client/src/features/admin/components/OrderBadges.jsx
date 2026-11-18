import { TriangleAlert } from 'lucide-react';

import { orderStatusInfo, PAYMENT_ISSUE_TOOLTIP } from '../lib/orderFlow';
import StatusBadge from './StatusBadge';

/** @param {{ status: string }} props */
export function OrderStatusBadge({ status }) {
  const { label, tone } = orderStatusInfo(status);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

/** Amber badge for an order whose payment needs an admin (usually a manual refund). */
export function NeedsRefundBadge() {
  return (
    <span
      title={PAYMENT_ISSUE_TOOLTIP}
      className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
    >
      <TriangleAlert size={10} aria-hidden="true" /> Needs refund
    </span>
  );
}
