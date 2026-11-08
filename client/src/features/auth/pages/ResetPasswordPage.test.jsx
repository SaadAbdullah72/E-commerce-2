import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  verifyRecoveryToken: vi.fn(),
  updatePassword: vi.fn(),
  cancelRecoverySession: vi.fn(),
}));
vi.mock('../services/passwordService', () => service);

import ResetPasswordPage from './ResetPasswordPage';

const NEW_PASSWORD = 'Kq7mWz2xPv9L';

function visit(search) {
  window.history.pushState({}, '', `/auth/reset${search}`);
}

/** StrictMode on purpose: it runs effects twice in development, as main.jsx does. */
function renderPage() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    </StrictMode>,
  );
}

async function openForm() {
  visit('?token_hash=abc123&type=recovery');
  service.verifyRecoveryToken.mockResolvedValue({ ok: true });
  const view = renderPage();
  await screen.findByLabelText('New password');
  return view;
}

async function fillForm(user, { password = NEW_PASSWORD, confirm = NEW_PASSWORD } = {}) {
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
}

beforeEach(() => {
  vi.resetAllMocks();
  service.cancelRecoverySession.mockResolvedValue(undefined);
});

describe('ResetPasswordPage: verifying the link', () => {
  it('verifies exactly once, even under StrictMode (the token is single-use)', async () => {
    await openForm();
    expect(service.verifyRecoveryToken).toHaveBeenCalledTimes(1);
    expect(service.verifyRecoveryToken).toHaveBeenCalledWith('abc123');
  });

  it('removes the token from the address bar', async () => {
    await openForm();
    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('abc123');
  });

  it('strips the token even when verification fails', async () => {
    visit('?token_hash=abc123&type=recovery');
    service.verifyRecoveryToken.mockResolvedValue({
      ok: false,
      error: { code: 'link_expired', message: 'x' },
    });

    renderPage();
    await screen.findByRole('heading', { name: 'This link is invalid or has expired' });
    expect(window.location.search).toBe('');
  });

  it('shows a loading state and NO form while verifying', () => {
    visit('?token_hash=abc123&type=recovery');
    service.verifyRecoveryToken.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status', { name: 'Checking your link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('shows the form only after the token was verified on this load', async () => {
    await openForm();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('shows "invalid" and no form when opened directly with no token', () => {
    visit('');
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'This link is invalid or has expired' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(service.verifyRecoveryToken).not.toHaveBeenCalled();
  });

  it('shows "invalid" and no form for a token the server rejects', async () => {
    visit('?token_hash=used&type=recovery');
    service.verifyRecoveryToken.mockResolvedValue({
      ok: false,
      error: { code: 'link_expired', message: 'x' },
    });

    renderPage();

    await screen.findByRole('heading', { name: 'This link is invalid or has expired' });
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('ResetPasswordPage: the form', () => {
  it('has an eye toggle shared by both fields and shows password strength', async () => {
    const user = userEvent.setup();
    await openForm();

    await user.type(screen.getByLabelText('New password'), NEW_PASSWORD);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Fair');

    await user.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text');
  });

  it('rejects weak or mismatched passwords without calling the server', async () => {
    const user = userEvent.setup();
    await openForm();

    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveFocus();

    await fillForm(user, { password: 'abcdefghijkl', confirm: 'abcdefghijkl' });
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/at least 12/i);
    expect(service.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    const user = userEvent.setup();
    await openForm();
    await fillForm(user, { confirm: 'Different12345' });

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getAllByText("Passwords don't match.").length).toBeGreaterThan(0);
    expect(service.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password, then says to sign in (no automatic login)', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockResolvedValue({ ok: true, otherSessionsRevoked: true });
    await openForm();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(service.updatePassword).toHaveBeenCalledWith(NEW_PASSWORD);
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(screen.getByText('Please sign in with your new password.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when other devices could not be signed out', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockResolvedValue({ ok: true, otherSessionsRevoked: false });
    await openForm();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await screen.findByRole('heading', { name: 'Password updated' });
    expect(screen.getByRole('status')).toHaveTextContent(/other devices/);
  });

  it('shows a loading state and ignores a second submit while saving', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockReturnValue(new Promise(() => {}));
    await openForm();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    const busy = screen.getByRole('button', { name: /updating password/i });
    expect(busy).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(service.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('puts "same as old password" on the field and moves focus back to it', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockResolvedValue({
      ok: false,
      error: {
        code: 'same_password',
        message: 'Your new password must be different from your current one.',
      },
    });
    await openForm();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText(/must be different from your current one/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('New password')).toHaveFocus());
  });

  it('shows the "invalid" screen if the recovery session expired before saving', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockResolvedValue({
      ok: false,
      error: { code: 'link_expired', message: 'x' },
    });
    await openForm();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(
      await screen.findByRole('heading', { name: 'This link is invalid or has expired' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('shows network errors and keeps the form so the user can retry', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockResolvedValue({
      ok: false,
      error: {
        code: 'network',
        message: "Can't reach the server. Check your internet connection.",
      },
    });
    await openForm();
    await fillForm(user);

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
    expect(screen.getByLabelText('New password')).toHaveValue(NEW_PASSWORD);
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled();
  });
});

describe('ResetPasswordPage: leaving the page', () => {
  it('does not drop the recovery session just because StrictMode remounts', async () => {
    await openForm();
    expect(service.cancelRecoverySession).not.toHaveBeenCalled();
  });

  it('drops the temporary recovery session if the user leaves without saving', async () => {
    const { unmount } = await openForm();
    unmount();
    expect(service.cancelRecoverySession).toHaveBeenCalledTimes(1);
  });

  it('does not touch the session when leaving after a successful update', async () => {
    const user = userEvent.setup();
    service.updatePassword.mockResolvedValue({ ok: true, otherSessionsRevoked: true });
    const { unmount } = await openForm();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByRole('heading', { name: 'Password updated' });

    unmount();
    expect(service.cancelRecoverySession).not.toHaveBeenCalled();
  });

  it('does nothing when the link was never valid', async () => {
    visit('?token_hash=used&type=recovery');
    service.verifyRecoveryToken.mockResolvedValue({
      ok: false,
      error: { code: 'link_expired', message: 'x' },
    });
    const { unmount } = renderPage();
    await screen.findByRole('heading', { name: 'This link is invalid or has expired' });

    unmount();
    expect(service.cancelRecoverySession).not.toHaveBeenCalled();
  });
});
