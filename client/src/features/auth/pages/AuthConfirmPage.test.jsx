import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  confirmSignupEmail: vi.fn(),
  resendSignupEmail: vi.fn(),
}));

vi.mock('../services/signupService', () => ({
  ...service,
  CONFIRM_TOKEN_TYPES: ['email', 'signup'],
}));

import AuthConfirmPage from './AuthConfirmPage';

function visit(search) {
  window.history.pushState({}, '', `/auth/confirm${search}`);
}

/** StrictMode on purpose: it runs effects twice in development, as main.jsx does. */
function renderPage() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <AuthConfirmPage />
      </MemoryRouter>
    </StrictMode>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe('AuthConfirmPage: verification', () => {
  it('verifies exactly once, even under StrictMode (the token is single-use)', async () => {
    visit('?token_hash=abc123&type=email');
    service.confirmSignupEmail.mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByRole('heading', { name: 'Email verified' });

    expect(service.confirmSignupEmail).toHaveBeenCalledTimes(1);
    expect(service.confirmSignupEmail).toHaveBeenCalledWith({
      tokenHash: 'abc123',
      type: 'email',
    });
  });

  it('removes the token from the address bar', async () => {
    visit('?token_hash=abc123&type=email');
    service.confirmSignupEmail.mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByRole('heading', { name: 'Email verified' });

    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('abc123');
  });

  it('strips the token even when verification fails', async () => {
    visit('?token_hash=abc123&type=email');
    service.confirmSignupEmail.mockResolvedValue({
      ok: false,
      error: { code: 'link_expired', message: 'x' },
    });

    renderPage();
    await screen.findByRole('heading', { name: 'This link has expired' });
    expect(window.location.search).toBe('');
  });

  it('shows a loading state while verifying', () => {
    visit('?token_hash=abc123&type=email');
    service.confirmSignupEmail.mockReturnValue(new Promise(() => {}));

    renderPage();
    expect(screen.getByRole('status', { name: 'Confirming your email' })).toBeInTheDocument();
  });

  it('on success offers a link to sign in', async () => {
    visit('?token_hash=abc123&type=email');
    service.confirmSignupEmail.mockResolvedValue({ ok: true });

    renderPage();
    const link = await screen.findByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('shows the expired screen for a link the server rejects', async () => {
    visit('?token_hash=used&type=email');
    service.confirmSignupEmail.mockResolvedValue({
      ok: false,
      error: { code: 'link_expired', message: 'x' },
    });

    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'This link has expired' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['no token at all', ''],
    ['token without a type', '?token_hash=abc'],
    ['type without a token', '?type=email'],
    ['a recovery token (belongs on /auth/reset)', '?token_hash=abc&type=recovery'],
    ['an unknown type', '?token_hash=abc&type=magiclink'],
  ])('does not call Supabase for %s', (_name, search) => {
    visit(search);

    renderPage();

    expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    expect(service.confirmSignupEmail).not.toHaveBeenCalled();
  });
});

describe('AuthConfirmPage: requesting a new link', () => {
  beforeEach(() => {
    visit('');
  });

  it('asks for a valid email first', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Request a new link' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(service.resendSignupEmail).not.toHaveBeenCalled();
  });

  it('resends, shows a neutral message and starts the cooldown', async () => {
    const user = userEvent.setup();
    service.resendSignupEmail.mockResolvedValue({ ok: true });
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'Name@Example.com');
    await user.click(screen.getByRole('button', { name: 'Request a new link' }));

    // The service (not the page) lower-cases and trims; see signupService tests.
    expect(service.resendSignupEmail).toHaveBeenCalledWith('Name@Example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(
      "If this address is waiting for confirmation, we've sent a new link.",
    );
    expect(screen.getByRole('button', { name: /Request a new link in \d+s/ })).toBeDisabled();
  });

  it('shows rate-limit errors from the server', async () => {
    const user = userEvent.setup();
    service.resendSignupEmail.mockResolvedValue({
      ok: false,
      error: { code: 'rate_limited', message: 'Too many attempts. Please wait a few minutes.' },
    });
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'Request a new link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });
});
