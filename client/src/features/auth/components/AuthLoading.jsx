import { Loader2 } from 'lucide-react';

/** Full-page spinner shown while the session is being checked. */
export default function AuthLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50"
      role="status"
      aria-label="Checking your session"
    >
      <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
    </div>
  );
}
