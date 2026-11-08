import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConfirmPasswordField, { CONFIRM_DEBOUNCE_MS } from './ConfirmPasswordField';

const PASSWORD = 'Abcdefghij12';

function Harness({ error }) {
  const [value, setValue] = useState('');
  return (
    <ConfirmPasswordField
      id="confirm"
      password={PASSWORD}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      visible={false}
      onToggleVisible={() => {}}
      error={error}
    />
  );
}

function type(value) {
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value } });
}

function wait(ms = CONFIRM_DEBOUNCE_MS) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('ConfirmPasswordField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing before the user types', () => {
    render(<Harness />);
    wait(1000);
    expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument();
    expect(screen.queryByText('Passwords match.')).not.toBeInTheDocument();
  });

  it('waits 300 ms of silence before reporting a mismatch', () => {
    render(<Harness />);
    type('Abc');

    wait(CONFIRM_DEBOUNCE_MS - 1);
    expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument();

    wait(1);
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('restarts the wait on every keystroke', () => {
    render(<Harness />);
    type('A');
    wait(200);
    type('Ab');
    wait(200);
    expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument();

    wait(100);
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
  });

  it('shows a green confirmation with text when the passwords match', () => {
    render(<Harness />);
    type(PASSWORD);
    wait();

    expect(screen.getByText('Passwords match.')).toBeInTheDocument();
    expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).not.toHaveAttribute('aria-invalid');
  });

  it('clears the mismatch message once the user corrects the value', () => {
    render(<Harness />);
    type('wrong');
    wait();
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();

    type(PASSWORD);
    wait();
    expect(screen.queryByText("Passwords don't match.")).not.toBeInTheDocument();
    expect(screen.getByText('Passwords match.')).toBeInTheDocument();
  });

  it('lets a submit-time error from the parent take priority', () => {
    render(<Harness error="Confirm your password." />);
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument();
  });

  it('has an eye toggle but no strength indicator', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    expect(screen.queryByText(/password strength/i)).not.toBeInTheDocument();
  });
});
