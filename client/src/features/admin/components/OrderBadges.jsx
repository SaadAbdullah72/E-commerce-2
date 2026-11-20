import { TriangleAlert } from 'lucide-react';

import Badge from '@/shared/ui/Badge';

import { orderStatusInfo, PAYMENT_ISSUE_TOOLTIP } from '../lib/orderFlow';
import StatusBadge from './StatusBadge';

/** @param {{ status: string }} props */
export function OrderStatusBadge({ status }) {
  const { label, tone } = orderStatusInfo(status);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

/** Red badge for an order whose payment needs an admin (usually a manual refund). */
export function NeedsRefundBadge() {
  return (
    <Badge tone="red" icon={TriangleAlert} title={PAYMENT_ISSUE_TOOLTIP}>
      Needs refund
    </Badge>
  );
}
