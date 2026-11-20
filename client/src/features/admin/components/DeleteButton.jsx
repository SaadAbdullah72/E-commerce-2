import { Trash2 } from 'lucide-react';

import { focusRing } from '@/shared/design/tokens';

/**
 * The red trash icon that sits next to Deactivate / Pause.
 *
 * @param {object} props
 * @param {string} props.label what it deletes, e.g. "Desk lamp" (used for the accessible name)
 * @param {() => void} props.onClick
 * @param {string} [props.disabledReason] when set, the button is disabled and this is its tooltip
 */
export default function DeleteButton({ label, onClick, disabledReason = '' }) {
  const disabled = Boolean(disabledReason);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : 'Delete permanently'}
      aria-label={`Delete ${label}`}
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-red-700 transition-colors duration-150 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent max-md:h-11 max-md:w-11 ${focusRing}`}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}
