import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import TextField from '../components/TextField';
import { useCooldown } from '../hooks/useCooldown';
import { RESEND_SIGNUP_COOLDOWN } from '../lib/cooldowns';
import {
  CONFIRM_TOKEN_TYPES,
  confirmSignupEmail,
  resendSignupEmail,
} from '../services/signupService';
import { validateEmail } from '../validation/signup';

/** Read the one-time token from the address bar. Runs only before the URL is cleaned. */
function readTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return { tokenHash: params.get('token_hash') ?? '', type: params.get('type') ?? '' };
}

/**
 * Landing page for the confirmation email link: /auth/confirm?token_hash=…&type=email
 *
 * - Verifies on mount, exactly once (a ref guard survives React StrictMode's double effect;
 *   a second verifyOtp call would fail because the token is single-use).
 * - Removes the token from the address bar immediately, so it cannot linger in history.
 * - After success the Supabase session is dropped locally (see confirmSignupEmail): this
 *   phase ends at "please sign in".
 */
export default function AuthConfirmPage() {
  const [token] = useState(readTokenFromUrl);
  const hasToken = Boolean(token.tokenHash) && CONFIRM_TOKEN_TYPES.includes(token.type);
  const [status, setStatus] = useState(hasToken ? 'verifying' : 'failed');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Strip the token from the URL before doing anything else.
    window.history.replaceState(null, '', window.location.pathname);

    if (!hasToken) return;
    confirmSignupEmail(token).then((result) => setStatus(result.ok ? 'success' : 'failed'));
  }, [hasToken, token]);

  if (status === 'verifying') {
    return (
      <AuthLayout title="Confirming your email…" subtitle="This only takes a moment.">
        <div className="flex justify-center py-4" role="status" aria-label="Confirming your email">
          <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
        </div>
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout
        icon={CheckCircle2}
        title="Email verified"
        subtitle="Your account is ready. Please sign in to continue."
      >
        <Link
          to="/login"
          className="block w-full rounded-xl bg-blue-600 py-3 text-center text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Sign in
        </Link>
      </AuthLayout>
    );
  }

  return <ConfirmFailed />;
}

/** Same screen for expired, already-used and malformed links: no detail is given away. */
function ConfirmFailed() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const { remaining, isCoolingDown, start } = useCooldown(
    RESEND_SIGNUP_COOLDOWN.key,
    RESEND_SIGNUP_COOLDOWN.seconds,
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSending || isCoolingDown) return;

    const problem = validateEmail(email);
    setEmailError(problem ?? '');
    if (problem) return;

    setIsSending(true);
    setFeedback(null);
    const result = await resendSignupEmail(email);
    setIsSending(false);

    if (result.ok) {
      start();
      setFeedback({
        variant: 'success',
        text: "If this address is waiting for confirmation, we've sent a new link.",
      });
    } else {
      setFeedback({ variant: 'error', text: result.error.message });
    }
  }

  return (
    <AuthLayout
      icon={MailWarning}
      title="This link has expired"
      subtitle="The confirmation link is invalid, already used, or too old. Request a new one below."
      footer={
        <Link to="/signup" className="font-bold text-blue-600 hover:underline">
          Back to sign up
        </Link>
      }
    >
      {feedback && <FormAlert variant={feedback.variant}>{feedback.text}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id="resend-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          error={emailError}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || isCoolingDown}
          aria-busy={isSending}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Sending…</span>
            </>
          ) : isCoolingDown ? (
            <span>Request a new link in {remaining}s</span>
          ) : (
            <span>Request a new link</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
