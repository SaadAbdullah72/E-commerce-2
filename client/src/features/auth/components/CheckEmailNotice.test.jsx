import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ resendSignupEmail: vi.fn() }));
vi.mock('../services/signupService', () => service);

import { beginCooldown } from '../hooks/useCooldown';
import { RESEND_SIGNUP_COOLDOWN } from '../lib/cooldowns';
import CheckEmailNotice from './CheckEmailNotice';

function renderNotice(props = {}) {
  return render(
    <MemoryRouter>
      <CheckEmailNotice email="ayesha@example.com" onUseDifferentEmail={() => {}} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe('CheckEmailNotice', () => {
  it('uses wording that does not reveal whether the address is registered', () => {
    renderNotice();
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/if it isn't already registered/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'reset your password' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('resends, confirms neutrally and starts the cooldown', async () => {
    const user = userEvent.setup();
    service.resendSignupEmail.mockResolvedValue({ ok: true });
    renderNotice();

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(service.resendSignupEmail).toHaveBeenCalledWith('ayesha@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent("we've sent a new link");
    expect(screen.getByRole('button', { name: /Resend email in 60s/ })).toBeDisabled();
  });

  it('cannot be clicked again during the cooldown', async () => {
    const user = userEvent.setup();
    beginCooldown(RESEND_SIGNUP_COOLDOWN.key, RESEND_SIGNUP_COOLDOWN.seconds);
    renderNotice();

    const button = screen.getByRole('button', { name: /Resend email in \d+s/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(service.resendSignupEmail).not.toHaveBeenCalled();
  });

  it('shows an error and starts the cooldown when rate limited', async () => {
    const user = userEvent.setup();
    service.resendSignupEmail.mockResolvedValue({
      ok: false,
      error: { code: 'rate_limited', message: 'Too many attempts. Please wait a few minutes.' },
    });
    renderNotice();

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
    expect(screen.getByRole('button', { name: /Resend email in \d+s/ })).toBeDisabled();
  });

  it('lets the user retry straight away after a network error', async () => {
    const user = userEvent.setup();
    service.resendSignupEmail.mockResolvedValue({
      ok: false,
      error: { code: 'network', message: "Can't reach the server." },
    });
    renderNotice();

    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });

  it('calls back when the user wants a different email', async () => {
    const user = userEvent.setup();
    const onUseDifferentEmail = vi.fn();
    renderNotice({ onUseDifferentEmail });

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(onUseDifferentEmail).toHaveBeenCalledTimes(1);
  });
});
