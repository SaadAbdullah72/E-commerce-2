import { Loader2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useCooldown } from '../hooks/useCooldown';
import { RESEND_SIGNUP_COOLDOWN } from '../lib/cooldowns';
import { resendSignupEmail } from '../services/signupService';
import AuthLayout from './AuthLayout';
import FormAlert from './FormAlert';

/**
 * Shown after signup. The wording is identical whether or not the address already has
 * an account, so it cannot be used to discover who is registered.
 *
 * @param {object} props
 * @param {string} props.email The address the user typed.
 * @param {() => void} props.onUseDifferentEmail
 */
export default function CheckEmailNotice({ email, onUseDifferentEmail }) {
  const { remaining, isCoolingDown, start } = useCooldown(
    RESEND_SIGNUP_COOLDOWN.key,
    RESEND_SIGNUP_COOLDOWN.seconds,
  );
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { variant, text } | null

  async function handleResend() {
    if (isSending || isCoolingDown) return;
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
      if (result.error.code === 'rate_limited') start();
      setFeedback({ variant: 'error', text: result.error.message });
    }
  }

  return (
    <AuthLayout
      icon={MailCheck}
      title="Check your email"
      subtitle={`We've sent a confirmation link to ${email}, if it isn't already registered.`}
      footer={
        <>
          Already a member?{' '}
          <Link to="/login" className="font-bold text-blue-600 hover:underline">
            Sign in
          </Link>{' '}
          or{' '}
          <Link to="/forgot-password" className="font-bold text-blue-600 hover:underline">
            reset your password
          </Link>
          .
        </>
      }
    >
      <ul className="mb-5 list-disc space-y-1.5 pl-5 text-xs text-gray-600">
        <li>Open the link in the email to activate your account.</li>
        <li>The link works once and expires, so use it soon.</li>
        <li>Can&apos;t see it? Check your spam or promotions folder.</li>
      </ul>

      {feedback && <FormAlert variant={feedback.variant}>{feedback.text}</FormAlert>}

      <button
        type="button"
        onClick={handleResend}
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
          <span>Resend email in {remaining}s</span>
        ) : (
          <span>Resend email</span>
        )}
      </button>

      <button
        type="button"
        onClick={onUseDifferentEmail}
        className="mt-3 w-full cursor-pointer rounded-xl py-2 text-xs font-bold text-gray-600 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
      >
        Use a different email
      </button>
    </AuthLayout>
  );
}
