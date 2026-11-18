import { reviewStatusInfo } from '../lib/reviewStatus';
import StatusBadge from './StatusBadge';

/** @param {{ status: string }} props */
export function ReviewStatusBadge({ status }) {
  const { label, tone } = reviewStatusInfo(status);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
