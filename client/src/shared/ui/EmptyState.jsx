import { Inbox } from 'lucide-react';

/**
 * "Nothing here yet": an icon, a message, and an optional next step.
 *
 * @param {object} props
 * @param {string} props.message
 * @param {string} [props.title]
 * @param {import('react').ComponentType<{ size?: number, 'aria-hidden'?: boolean }>} [props.icon] a lucide icon
 * @param {import('react').ReactNode} [props.action] usually a Button or a link
 */
export default function EmptyState({ message, title, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Icon size={24} aria-hidden="true" />
      </span>
      {title && <h3 className="mt-3 text-base font-semibold text-gray-900">{title}</h3>}
      <p className="mt-1 max-w-sm text-sm text-gray-600">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
