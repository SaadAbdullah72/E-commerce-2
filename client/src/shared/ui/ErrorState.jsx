import { CircleAlert } from 'lucide-react';

import Button from './Button';

/**
 * A friendly error with a way to retry. Never pass a raw database error as `message`.
 * `code` is shown only while developing.
 *
 * @param {object} props
 * @param {string} props.message
 * @param {() => void} [props.onRetry]
 * @param {string} [props.retryLabel]
 * @param {string} [props.code]
 */
export default function ErrorState({ message, onRetry, retryLabel = 'Try again', code }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
        <CircleAlert size={24} aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-gray-900">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-600">{message}</p>
      {import.meta.env.DEV && code && <p className="mt-1 font-mono text-xs text-gray-500">{code}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
