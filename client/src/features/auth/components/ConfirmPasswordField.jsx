import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { validateConfirmPassword } from '../validation/signup';
import PasswordField from './PasswordField';

/** How long the user must stop typing before a mismatch is reported. */
export const CONFIRM_DEBOUNCE_MS = 300;

/**
 * "Confirm password" field with live feedback.
 *
 * Shows "Passwords don't match." (or a green check with "Passwords match.") only after the
 * user pauses typing for 300 ms. A submit-time `error` from the parent always wins.
 * It never shows a strength meter.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.password The main password field's current value.
 * @param {string} props.value
 * @param {(event: import('react').ChangeEvent<HTMLInputElement>) => void} props.onChange
 * @param {boolean} props.visible Shared with the main password field.
 * @param {() => void} props.onToggleVisible
 * @param {string} [props.error] Submit-time error from the parent form.
 * @param {boolean} [props.disabled]
 */
export default function ConfirmPasswordField({
  id,
  password,
  value,
  onChange,
  visible,
  onToggleVisible,
  error,
  disabled = false,
}) {
  // Snapshot of the inputs as of the last pause; feedback shows only while it is current.
  const [settled, setSettled] = useState({ password, value });

  useEffect(() => {
    const timer = setTimeout(() => setSettled({ password, value }), CONFIRM_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [password, value]);

  const isSettled = settled.password === password && settled.value === value;
  const hasTyped = value !== '';
  const mismatch = hasTyped && isSettled ? validateConfirmPassword(password, value) : null;
  const matches = hasTyped && isSettled && !mismatch;

  const hint = matches ? (
    <p className="flex items-center gap-1 font-medium text-emerald-700">
      <CheckCircle2 size={14} aria-hidden="true" />
      <span>Passwords match.</span>
    </p>
  ) : null;

  return (
    <PasswordField
      id={id}
      label="Confirm password"
      value={value}
      onChange={onChange}
      error={error || mismatch || undefined}
      hint={hint}
      showToggle
      visible={visible}
      onToggleVisible={onToggleVisible}
      disabled={disabled}
    />
  );
}
