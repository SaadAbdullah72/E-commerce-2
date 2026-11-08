import { KeyRound, Loader2, Mail, MailCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import TextField from '../components/TextField';
import { useCooldown } from '../hooks/useCooldown';
import { PASSWORD_RESET_COOLDOWN } from '../lib/cooldowns';
import { requestPasswordReset } from '../services/passwordService';
import { validateEmail } from '../validation/signup';

/** The one sentence shown after every request, whatever the server did. */
export const RESET_REQUESTED_MESSAGE = "If this email exists, we've sent a reset link.";

const PRIMARY_BUTTON =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const BACK_TO_LOGIN = (
  <Link to="/login" className="font-bold text-blue-600 hover:underline">
    Back to login
  </Link>
);

/**
 * Step one of password recovery: ask for an email and send the reset link.
 * The confirmation never says whether the address has an account.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const sendingRef = useRef(false); // blocks double submits before React re-renders
  const { remaining, isCoolingDown, start } = useCooldown(
    PASSWORD_RESET_COOLDOWN.key,
    PASSWORD_RESET_COOLDOWN.seconds,
  );

  /** Send one request. Returns the service result, or null if blocked. */
  async function send(address) {
    if (sendingRef.current || isCoolingDown) return null;
    sendingRef.current = true;
    setIsSending(true);
    setFormError('');

    const result = await requestPasswordReset(address);

    sendingRef.current = false;
    setIsSending(false);
    if (result.ok) start();
    else setFormError(result.error.message);
    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const problem = validateEmail(email);
    setEmailError(problem ?? '');
    if (problem) {
      document.getElementById('forgot-email')?.focus();
      return;
    }

    const result = await send(email);
    if (result?.ok) setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthLayout
        icon={MailCheck}
        title="Check your email"
        subtitle={RESET_REQUESTED_MESSAGE}
        footer={BACK_TO_LOGIN}
      >
        <ul className="mb-5 list-disc space-y-1.5 pl-5 text-xs text-gray-600">
          <li>Open the link in the email to choose a new password.</li>
          <li>The link works once and expires, so use it soon.</li>
          <li>Can&apos;t see it? Check your spam or promotions folder.</li>
        </ul>

        {formError && <FormAlert variant="error">{formError}</FormAlert>}

        <button
          type="button"
          onClick={() => send(sentTo)}
          disabled={isSending || isCoolingDown}
          aria-busy={isSending}
          className={PRIMARY_BUTTON}
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Sending…</span>
            </>
          ) : isCoolingDown ? (
            <span>Resend in {remaining}s</span>
          ) : (
            <span>Resend email</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-3 w-full cursor-pointer rounded-xl py-2 text-xs font-bold text-gray-600 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        >
          Use a different email
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={KeyRound}
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={BACK_TO_LOGIN}
    >
      {formError && <FormAlert variant="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <TextField
          id="forgot-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) setEmailError('');
          }}
          icon={Mail}
          autoComplete="email"
          placeholder="name@example.com"
          error={emailError}
          disabled={isSending}
          maxLength={254}
        />

        <button
          type="submit"
          disabled={isSending || isCoolingDown}
          aria-busy={isSending}
          className={PRIMARY_BUTTON}
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Sending…</span>
            </>
          ) : isCoolingDown ? (
            <span>Send reset link in {remaining}s</span>
          ) : (
            <span>Send reset link</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
