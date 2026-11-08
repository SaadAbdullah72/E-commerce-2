import { Loader2, LogIn, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import PasswordField from '../components/PasswordField';
import TextField from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import { useCooldown } from '../hooks/useCooldown';
import { usePasswordVisibility } from '../hooks/usePasswordVisibility';
import { RESEND_SIGNUP_COOLDOWN } from '../lib/cooldowns';
import { getSafeRedirect } from '../lib/safeRedirect';
import { signInWithEmail } from '../services/loginService';
import { resendSignupEmail } from '../services/signupService';
import { validateEmail } from '../validation/signup';

/**
 * Email + password sign-in.
 *
 * - Wrong password and unknown email show the same message.
 * - Navigation happens only once the provider reports the user (and role) as loaded, so
 *   the same code also redirects someone who opens /login while already signed in.
 * - The `redirect` query value is checked against an allow-list before use.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, isAdmin } = useAuth();
  const { visible, toggle } = usePasswordVisibility();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null); // { code, message }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const submittingRef = useRef(false);
  const focusAfterRender = useRef(null);
  const resendCooldown = useCooldown(RESEND_SIGNUP_COOLDOWN.key, RESEND_SIGNUP_COOLDOWN.seconds);

  const redirectTo = getSafeRedirect(searchParams.get('redirect'));

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(isAdmin ? '/admin' : redirectTo, { replace: true });
    }
  }, [status, isAdmin, redirectTo, navigate]);

  // A disabled input cannot take focus, so focus moves here, after React re-enables them.
  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    setResendNotice('');
    const found = {};
    const emailProblem = validateEmail(email);
    if (emailProblem) found.email = emailProblem;
    if (!password) found.password = 'Enter your password.';
    setErrors(found);

    if (found.email || found.password) {
      document.getElementById(found.email ? 'login-email' : 'login-password')?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const result = await signInWithEmail({ email, password });
    submittingRef.current = false;
    setIsSubmitting(false);

    if (result.ok) return; // the effect above navigates once the account is loaded

    setPassword('');
    setFormError(result.error);
    focusAfterRender.current = 'login-password';
  }

  async function handleResend() {
    if (resendCooldown.isCoolingDown) return;
    resendCooldown.start();
    await resendSignupEmail(email);
    setResendNotice("If this email isn't confirmed yet, we've sent a new confirmation link.");
  }

  const signupHref = searchParams.get('redirect')
    ? `/signup?redirect=${encodeURIComponent(searchParams.get('redirect'))}`
    : '/signup';

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Sign in to your ShopYaro account."
      footer={
        <>
          New to ShopYaro?{' '}
          <Link to={signupHref} className="font-bold text-blue-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {formError && <FormAlert variant="error">{formError.message}</FormAlert>}

      {formError?.code === 'email_not_confirmed' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown.isCoolingDown}
            className="w-full cursor-pointer rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendCooldown.isCoolingDown
              ? `Resend confirmation in ${resendCooldown.remaining}s`
              : 'Resend confirmation email'}
          </button>
          <p role="status" className="mt-2 text-[11px] text-gray-600">
            {resendNotice}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <TextField
          id="login-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
          }}
          icon={Mail}
          autoComplete="email"
          placeholder="name@example.com"
          error={errors.email}
          disabled={isSubmitting}
          maxLength={254}
        />

        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
          }}
          autoComplete="current-password"
          showToggle
          visible={visible}
          onToggleVisible={toggle}
          error={errors.password}
          disabled={isSubmitting}
        />

        <div className="text-right">
          <Link to="/forgot-password" className="text-xs font-bold text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
