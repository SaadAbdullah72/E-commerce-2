import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { completeOAuthCallback, consumeOAuthRedirect } from '../services/oauthService';

const FAILURE_COPY = {
  cancelled: {
    title: 'Sign-in cancelled',
    subtitle: 'You cancelled the Google sign-in. No changes were made.',
  },
  failed: {
    title: "We couldn't sign you in",
    subtitle: 'Something went wrong while signing in with Google. Please try again.',
  },
};

/** Read what Google/Supabase put in the address bar. Runs before the URL is cleaned. */
function readCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  return { hasCode: Boolean(params.get('code')), error: params.get('error') };
}

/**
 * Landing page for /auth/callback after "Continue with Google".
 *
 * - Runs once (ref guard, so React StrictMode cannot run it twice).
 * - Waits for the Supabase client to finish the code exchange BEFORE cleaning the URL.
 * - Leaves only after the provider has loaded the user's role, so admins go to /admin.
 * - The destination comes from sessionStorage and is allow-listed, never from the URL.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { status, isAdmin } = useAuth();
  const [params] = useState(readCallbackParams);
  const [failure, setFailure] = useState(null); // 'cancelled' | 'failed'
  const [destination, setDestination] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    completeOAuthCallback(params).then((result) => {
      // Now that the client has read it, remove the one-time code from the address bar.
      window.history.replaceState(null, '', window.location.pathname);
      if (result.ok) setDestination(consumeOAuthRedirect());
      else setFailure(result.code);
    });
  }, [params]);

  useEffect(() => {
    if (destination && status === 'authenticated') {
      navigate(isAdmin ? '/admin' : destination, { replace: true });
    }
  }, [destination, status, isAdmin, navigate]);

  if (failure) {
    const copy = FAILURE_COPY[failure];
    return (
      <AuthLayout icon={ShieldAlert} title={copy.title} subtitle={copy.subtitle}>
        <Link
          to="/login"
          className="block w-full rounded-xl bg-blue-600 py-3 text-center text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Back to login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Signing you in…" subtitle="This only takes a moment.">
      <div className="flex justify-center py-4" role="status" aria-label="Signing you in">
        <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
      </div>
    </AuthLayout>
  );
}
