import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const VARIANTS = {
  error: {
    icon: AlertTriangle,
    classes: 'border-red-200 bg-red-50 text-red-700',
    role: 'alert',
  },
  success: {
    icon: CheckCircle2,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    role: 'status',
  },
  info: {
    icon: Info,
    classes: 'border-blue-200 bg-blue-50 text-blue-800',
    role: 'status',
  },
};

/**
 * Inline message box. Errors use role="alert" so screen readers announce them at once.
 *
 * @param {object} props
 * @param {'error' | 'success' | 'info'} [props.variant]
 * @param {import('react').ReactNode} props.children
 */
export default function FormAlert({ variant = 'error', children }) {
  const { icon: Icon, classes, role } = VARIANTS[variant];

  return (
    <div
      role={role}
      className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${classes}`}
    >
      <Icon size={16} className="mt-px shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
