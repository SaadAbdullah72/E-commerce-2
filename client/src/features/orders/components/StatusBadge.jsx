import { statusInfo, TONE_CLASSES } from '../lib/orderStatus';

/** @param {{ status: string }} props */
export default function StatusBadge({ status }) {
  const { label, tone } = statusInfo(status);
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
