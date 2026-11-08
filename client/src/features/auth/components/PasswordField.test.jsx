import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { usePasswordVisibility } from '../hooks/usePasswordVisibility';
import ConfirmPasswordField from './ConfirmPasswordField';
import PasswordField from './PasswordField';

function Single(props) {
  const [value, setValue] = useState('');
  return (
    <PasswordField
      id="pw"
      label="Password"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      {...props}
    />
  );
}

/** Password + confirm field sharing one eye toggle, as the signup and reset forms do. */
function SyncedPair() {
  const { visible, toggle } = usePasswordVisibility();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <>
      <PasswordField
        id="pw"
        label="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        showToggle
        visible={visible}
        onToggleVisible={toggle}
      />
      <ConfirmPasswordField
        id="confirm"
        password={password}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        visible={visible}
        onToggleVisible={toggle}
      />
    </>
  );
}

describe('PasswordField', () => {
  it('is hidden by default and links the label to the input', () => {
    render(<Single />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('renders no eye button unless showToggle is set', () => {
    render(<Single />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toggles visibility and updates the accessible name', async () => {
    const user = userEvent.setup();
    render(<Single showToggle />);

    const input = screen.getByLabelText('Password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('is operable with the keyboard (Tab, then Enter or Space)', async () => {
    const user = userEvent.setup();
    render(<Single showToggle />);
    const input = screen.getByLabelText('Password');

    await user.click(input);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(input).toHaveAttribute('type', 'text');

    await user.keyboard(' ');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('never submits the surrounding form when the eye is pressed', async () => {
    const user = userEvent.setup();
    let submitted = false;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <Single showToggle />
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(submitted).toBe(false);
  });

  it('marks the input invalid and ties the error to it', () => {
    render(<Single error="Enter a password." />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a password.');
  });

  it('does not mark a valid field invalid', () => {
    render(<Single />);
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
  });
});

describe('shared eye toggle (password + confirm password)', () => {
  it('starts with both fields hidden', () => {
    render(<SyncedPair />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
  });

  it('toggling either eye switches both fields', async () => {
    const user = userEvent.setup();
    render(<SyncedPair />);

    const [firstEye, secondEye] = screen.getAllByRole('button', { name: 'Show password' });
    await user.click(firstEye);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text');

    // Both buttons now offer "Hide password"; use the second one to switch back.
    expect(screen.getAllByRole('button', { name: 'Hide password' })).toHaveLength(2);
    await user.click(secondEye);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
  });
});
