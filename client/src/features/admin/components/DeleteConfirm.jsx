import ConfirmDialog from './ConfirmDialog';

/**
 * "Delete permanently?" box. No typing needed, but the wording is plain about it being final.
 *
 * @param {object} props
 * @param {string} props.name what is being deleted (shown in bold)
 * @param {string} props.kind e.g. "product"
 * @param {boolean} props.busy
 * @param {string} [props.error] friendly message from a failed attempt
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function DeleteConfirm({ name, kind, busy, error = '', onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      title={`Delete this ${kind}?`}
      confirmLabel="Delete permanently"
      danger
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        <strong>{name}</strong> will be deleted permanently. This cannot be undone.
      </p>
      <p className="mt-2 text-xs text-gray-500">The change is recorded in the Activity log.</p>
      {error && (
        <p role="alert" className="mt-2 font-semibold text-red-600">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
