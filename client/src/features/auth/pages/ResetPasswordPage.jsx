import { CheckCircle2, KeyRound, Loader2, MailWarning } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import ConfirmPasswordField from '../components/ConfirmPasswordField';
import FormAlert from '../components/FormAlert';
import PasswordField from '../components/PasswordField';
import PasswordStrength from '../components/PasswordStrength';
import { usePasswordVisibility } from '../hooks/usePasswordVisibility';
import {
  cancelRecoverySession,
  updatePassword,
  verifyRecoveryToken,
} from '../services/passwordService';
import { getPasswordError } from '../validation/password';
import { validateConfirmPassword } from '../validation/signup';

const PRIMARY_LINK =
  'block w-full rounded-xl bg-blue-600 py-3 text-center text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none';

/** Copy of an errors object without one key. */
function without(errors, key) {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== key));
}

/** Read the one-time token from the address bar. Runs only before the URL is cleaned. */
function readTokenHash() {
  return new URLSearchParams(window.location.search).get('token_hash') ?? '';
}

/**
 * Step two of password recovery: /auth/reset?token_hash=…&type=recovery
 *
 * Security rules this page follows:
 *  - The new-password form appears ONLY if the token was verified during THIS page load.
 *    An existing login session, or no token, never unlocks it.
 *  - Verification runs once (ref guard, so React StrictMode's double effect cannot burn
 *    the single-use token) and the token is removed from the address bar immediately.
 *  - After the password changes, all sessions are ended; the user must sign in again.
 *  - Leaving without choosing a password drops the temporary recovery session (best effort).
 */
export default function ResetPasswordPage() {
  const [tokenHash] = useState(readTokenHash);
  const [status, setStatus] = useState(tokenHash ? 'verifying' : 'invalid');
  const [otherSessionsRevoked, setOtherSessionsRevoked] = useState(true);
  const started = useRef(false);
  const recoveryActive = useRef(false); // a recovery session exists and no password was set yet

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Strip the token from the URL before doing anything else.
    window.history.replaceState(null, '', window.location.pathname);

    if (!tokenHash) return;
    verifyRecoveryToken(tokenHash).then((result) => {
      recoveryActive.current = result.ok;
      setStatus(result.ok ? 'ready' : 'invalid');
    });
  }, [tokenHash]);

  // Separate effect so its cleanup is always registered. In StrictMode's simulated unmount
  // verification has not finished yet, so recoveryActive is still false and nothing happens.
  useEffect(
    () => () => {
      if (recoveryActive.current) cancelRecoverySession();
    },
    [],
  );

  function handleDone(result) {
    recoveryActive.current = false;
    setOtherSessionsRevoked(result.otherSessionsRevoked);
    setStatus('done');
  }

  function handleExpired() {
    recoveryActive.current = false;
    setStatus('invalid');
  }

  if (status === 'verifying') {
    return (
      <AuthLayout title="Checking your link…" subtitle="This only takes a moment.">
        <div className="flex justify-center py-4" role="status" aria-label="Checking your link">
          <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
        </div>
      </AuthLayout>
    );
  }

  if (status === 'done') {
    return (
      <AuthLayout
        icon={CheckCircle2}
        title="Password updated"
        subtitle="Please sign in with your new password."
      >
        {!otherSessionsRevoked && (
          <FormAlert variant="info">
            We couldn&apos;t sign you out on your other devices. If you think someone else has
            access to your account, change your password again.
          </FormAlert>
        )}
        <Link to="/login" className={PRIMARY_LINK}>
          Sign in
        </Link>
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    // One screen for expired, already-used and malformed links: nothing is given away.
    return (
      <AuthLayout
        icon={MailWarning}
        title="This link is invalid or has expired"
        subtitle="Password reset links work once and expire quickly. Request a new one to continue."
        footer={
          <Link to="/login" className="font-bold text-blue-600 hover:underline">
            Back to login
          </Link>
        }
      >
        <Link to="/forgot-password" className={PRIMARY_LINK}>
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return <NewPasswordForm onDone={handleDone} onExpired={handleExpired} />;
}

/**
 * @param {object} props
 * @param {(result: { otherSessionsRevoked: boolean }) => void} props.onDone
 * @param {() => void} props.onExpired
 */
function NewPasswordForm({ onDone, onExpired }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const focusAfterRender = useRef(null);
  const { visible, toggle } = usePasswordVisibility();

  // A disabled input cannot take focus, so focus moves here, after React re-enables them.
  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;

    setFormError('');
    const found = {};
    const passwordProblem = getPasswordError(password);
    const confirmProblem = validateConfirmPassword(password, confirm);
    if (passwordProblem) found.password = passwordProblem;
    if (confirmProblem) found.confirm = confirmProblem;
    setErrors(found);

    if (found.password || found.confirm) {
      document.getElementById(found.password ? 'reset-password' : 'reset-confirm')?.focus();
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    const result = await updatePassword(password);
    savingRef.current = false;
    setIsSaving(false);

    if (result.ok) {
      onDone(result);
      return;
    }

    switch (result.error.code) {
      case 'link_expired':
        onExpired();
        break;
      case 'weak_password':
      case 'same_password':
        setErrors({ password: result.error.message });
        focusAfterRender.current = 'reset-password';
        break;
      default:
        setFormError(result.error.message);
    }
  }

  return (
    <AuthLayout
      icon={KeyRound}
      title="Choose a new password"
      subtitle="You'll be asked to sign in again afterwards."
    >
      {formError && <FormAlert variant="error">{formError}</FormAlert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <PasswordField
            id="reset-password"
            label="New password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors((current) => without(current, 'password'));
            }}
            showToggle
            visible={visible}
            onToggleVisible={toggle}
            error={errors.password}
            disabled={isSaving}
          />
          <PasswordStrength password={password} />
        </div>

        <ConfirmPasswordField
          id="reset-confirm"
          password={password}
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            if (errors.confirm) setErrors((current) => without(current, 'confirm'));
          }}
          visible={visible}
          onToggleVisible={toggle}
          error={errors.confirm}
          disabled={isSaving}
        />

        <button
          type="submit"
          disabled={isSaving}
          aria-busy={isSaving}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Updating password…</span>
            </>
          ) : (
            <span>Update password</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
