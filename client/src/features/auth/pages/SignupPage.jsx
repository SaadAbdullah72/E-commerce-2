import { ArrowRight, Loader2, Mail, ShieldCheck, User, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { TERMS_VERSION } from '@/features/legal/constants';

import AuthLayout from '../components/AuthLayout';
import CheckEmailNotice from '../components/CheckEmailNotice';
import ConfirmPasswordField from '../components/ConfirmPasswordField';
import FormAlert from '../components/FormAlert';
import PasswordField from '../components/PasswordField';
import PasswordStrength from '../components/PasswordStrength';
import TextField from '../components/TextField';
import { beginCooldown } from '../hooks/useCooldown';
import { usePasswordVisibility } from '../hooks/usePasswordVisibility';
import { RESEND_SIGNUP_COOLDOWN } from '../lib/cooldowns';
import { getSafeRedirect } from '../lib/safeRedirect';
import { signUpWithEmail } from '../services/signupService';
import { getPasswordError } from '../validation/password';
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateSignupForm,
  validateTerms,
} from '../validation/signup';

const EMPTY = { fullName: '', email: '', password: '', confirmPassword: '', termsAccepted: false };

/** Field-level validators used to refresh one error while the user edits that field. */
const FIELD_VALIDATORS = {
  fullName: (v) => validateFullName(v.fullName),
  email: (v) => validateEmail(v.email),
  password: (v) => getPasswordError(v.password),
  confirmPassword: (v) => validateConfirmPassword(v.password, v.confirmPassword),
  termsAccepted: (v) => validateTerms(v.termsAccepted),
};

// Field name -> error key + element id, in on-screen order (used to focus the first problem).
const FIELD_ORDER = [
  ['fullName', 'fullName', 'signup-name'],
  ['email', 'email', 'signup-email'],
  ['password', 'password', 'signup-password'],
  ['confirmPassword', 'confirmPassword', 'signup-confirm'],
  ['termsAccepted', 'terms', 'signup-terms'],
];

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const redirect = getSafeRedirect(searchParams.get('redirect'));
  // The legacy login page expects "?redirect=shipping" (no slash); drop this when it is replaced.
  const loginHref = redirect === '/' ? '/login' : `/login?redirect=${redirect.slice(1)}`;

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const submittingRef = useRef(false); // blocks double submits before React re-renders
  const focusAfterRender = useRef(null); // id to focus once inputs are enabled again
  const { visible, toggle } = usePasswordVisibility();

  // The inputs are disabled while submitting, and a disabled input cannot take focus. So after
  // a failed submit, focus is moved here, after React has re-enabled them.
  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });

  function update(field, value) {
    const next = { ...values, [field]: value };
    setValues(next);

    // Only refresh an error that is already showing; do not nag while the user is still typing.
    setErrors((current) => {
      const updated = { ...current };
      const key = field === 'termsAccepted' ? 'terms' : field;
      if (current[key]) {
        const problem = FIELD_VALIDATORS[field](next);
        if (problem) updated[key] = problem;
        else delete updated[key];
      }
      // Changing the password can fix or break the "confirm" match.
      if (field === 'password' && current.confirmPassword) {
        const problem = validateConfirmPassword(next.password, next.confirmPassword);
        if (problem) updated.confirmPassword = problem;
        else delete updated.confirmPassword;
      }
      return updated;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError('');
    const { valid, errors: found } = validateSignupForm(values);
    setErrors(found);

    if (!valid) {
      const first = FIELD_ORDER.find(([, key]) => found[key]);
      if (first) document.getElementById(first[2])?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const result = await signUpWithEmail({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      termsAccepted: values.termsAccepted,
      termsVersion: TERMS_VERSION,
    });
    submittingRef.current = false;
    setIsSubmitting(false);

    if (result.ok) {
      // An email was just sent, so the resend button on the next screen starts cooling down.
      beginCooldown(RESEND_SIGNUP_COOLDOWN.key, RESEND_SIGNUP_COOLDOWN.seconds);
      setSentTo(values.email.trim());
      // Do not keep the password in memory longer than needed.
      setValues((current) => ({ ...current, password: '', confirmPassword: '' }));
      return;
    }

    if (result.error.code === 'weak_password') {
      setErrors((current) => ({ ...current, password: result.error.message }));
      focusAfterRender.current = 'signup-password';
    } else {
      setFormError(result.error.message);
    }
  }

  if (sentTo) {
    return <CheckEmailNotice email={sentTo} onUseDifferentEmail={() => setSentTo(null)} />;
  }

  const personal = [...values.fullName.split(/\s+/), values.email.split('@')[0]].filter(Boolean);

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your ShopYaro account"
      subtitle="Join today for fast checkout and order tracking."
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginHref} className="font-bold text-blue-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {formError && <FormAlert variant="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <TextField
          id="signup-name"
          label="Full name"
          value={values.fullName}
          onChange={(event) => update('fullName', event.target.value)}
          icon={User}
          autoComplete="name"
          error={errors.fullName}
          disabled={isSubmitting}
          maxLength={100}
        />

        <TextField
          id="signup-email"
          label="Email address"
          type="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          icon={Mail}
          autoComplete="email"
          placeholder="name@example.com"
          error={errors.email}
          disabled={isSubmitting}
          maxLength={254}
        />

        <div>
          <PasswordField
            id="signup-password"
            label="Password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            showToggle
            visible={visible}
            onToggleVisible={toggle}
            error={errors.password}
            disabled={isSubmitting}
          />
          <PasswordStrength password={values.password} personal={personal} />
        </div>

        <ConfirmPasswordField
          id="signup-confirm"
          password={values.password}
          value={values.confirmPassword}
          onChange={(event) => update('confirmPassword', event.target.value)}
          visible={visible}
          onToggleVisible={toggle}
          error={errors.confirmPassword}
          disabled={isSubmitting}
        />

        <div>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-700">
            <input
              id="signup-terms"
              type="checkbox"
              checked={values.termsAccepted}
              onChange={(event) => update('termsAccepted', event.target.checked)}
              disabled={isSubmitting}
              aria-invalid={errors.terms ? 'true' : undefined}
              aria-describedby={errors.terms ? 'signup-terms-error' : undefined}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
            />
            <span>
              I agree to the{' '}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-blue-600 hover:underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-blue-600 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <div id="signup-terms-error" aria-live="polite" className="mt-1 min-h-[1rem] text-[11px]">
            {errors.terms && <p className="font-medium text-red-600">{errors.terms}</p>}
          </div>
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
              <span>Creating account…</span>
            </>
          ) : (
            <>
              <span>Create account</span>
              <ArrowRight size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-400">
        <ShieldCheck size={14} className="text-emerald-600" aria-hidden="true" />
        <span>Secure registration &amp; data privacy</span>
      </div>
    </AuthLayout>
  );
}
