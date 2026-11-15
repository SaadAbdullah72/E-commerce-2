import { Trash2 } from 'lucide-react';

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
      className="ml-3 inline-flex cursor-pointer items-center align-middle text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-gray-300"
    >
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}
