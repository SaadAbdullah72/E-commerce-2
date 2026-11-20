import { CircleCheck } from 'lucide-react';

import { focusRing } from '@/shared/design/tokens';

/**
 * The green "it worked" line at the top of a list page, with a Dismiss button.
 *
 * @param {{ children: import('react').ReactNode, onDismiss: () => void }} props
 */
export default function NoticeBanner({ children, onDismiss }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
    >
      <CircleCheck size={16} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        onClick={onDismiss}
        className={`cursor-pointer rounded px-2 py-1 text-xs font-bold underline hover:bg-green-100 max-md:min-h-11 ${focusRing}`}
      >
        Dismiss
      </button>
    </p>
  );
}
