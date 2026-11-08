import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
vi.mock('../services/passwordService', () => service);

import { beginCooldown } from '../hooks/useCooldown';
import { PASSWORD_RESET_COOLDOWN } from '../lib/cooldowns';
import ForgotPasswordPage, { RESET_REQUESTED_MESSAGE } from './ForgotPasswordPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe('ForgotPasswordPage: form', () => {
  it('asks only for an email and has a brand-blue button and a way back to login', () => {
    renderPage();

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Send reset link' });
    expect(button.className).toContain('bg-blue-600');
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
  });

  it('rejects an empty or invalid email without calling the server', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveFocus();

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(service.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe('ForgotPasswordPage: sending', () => {
  it('always shows the same neutral confirmation, never mentioning the account', async () => {
    const user = userEvent.setup();
    service.requestPasswordReset.mockResolvedValue({ ok: true });
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(service.requestPasswordReset).toHaveBeenCalledWith('someone@example.com');
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(RESET_REQUESTED_MESSAGE)).toBeInTheDocument();
    expect(RESET_REQUESTED_MESSAGE).toBe("If this email exists, we've sent a reset link.");
    expect(document.body.textContent).not.toMatch(
      /no account|not registered|not found|doesn't exist/i,
    );
  });

  it('starts a 60-second cooldown, kept across refreshes in sessionStorage', async () => {
    const user = userEvent.setup();
    service.requestPasswordReset.mockResolvedValue({ ok: true });
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
    const stored = Number(window.sessionStorage.getItem(PASSWORD_RESET_COOLDOWN.key));
    expect(stored).toBeGreaterThan(Date.now());
    expect(window.sessionStorage.getItem(PASSWORD_RESET_COOLDOWN.key)).not.toContain('@');
  });

  it('blocks submitting during an existing cooldown (e.g. after a refresh)', async () => {
    const user = userEvent.setup();
    beginCooldown(PASSWORD_RESET_COOLDOWN.key, PASSWORD_RESET_COOLDOWN.seconds);
    renderPage();

    const button = screen.getByRole('button', { name: /Send reset link in \d+s/ });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('Email address'), 'someone@example.com');
    await user.keyboard('{Enter}');
    expect(service.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('ignores a second submit while the first request is running', async () => {
    const user = userEvent.setup();
    service.requestPasswordReset.mockReturnValue(new Promise(() => {}));
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    const busy = screen.getByRole('button', { name: /sending/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.keyboard('{Enter}');
    expect(service.requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('shows a real problem (no network) and does not start a cooldown', async () => {
    const user = userEvent.setup();
    service.requestPasswordReset.mockResolvedValue({
      ok: false,
      error: {
        code: 'network',
        message: "Can't reach the server. Check your internet connection.",
      },
    });
    renderPage();

    await user.type(screen.getByLabelText('Email address'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
    expect(window.sessionStorage.getItem(PASSWORD_RESET_COOLDOWN.key)).toBeNull();
  });

  it('"Use a different email" goes back to the form', async () => {
    const user = userEvent.setup();
    service.requestPasswordReset.mockResolvedValue({ ok: true });
    renderPage();
    await user.type(screen.getByLabelText('Email address'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(screen.getByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument();
  });
});
