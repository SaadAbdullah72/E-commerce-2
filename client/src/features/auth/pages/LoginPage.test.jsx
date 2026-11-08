import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { status: 'anonymous', isAdmin: false },
  signInWithEmail: vi.fn(),
  resendSignupEmail: vi.fn(),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../services/loginService', () => ({ signInWithEmail: mocks.signInWithEmail }));
vi.mock('../services/signupService', () => ({ resendSignupEmail: mocks.resendSignupEmail }));

import LoginPage from './LoginPage';

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderAt(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fill(user, email = 'me@example.com', password = 'Secret-pass-1') {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password'), password);
}

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
  mocks.auth.status = 'anonymous';
  mocks.auth.isAdmin = false;
});

describe('LoginPage', () => {
  it('renders the form with an eye toggle and links to forgot-password and signup', async () => {
    const user = userEvent.setup();
    renderAt();

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('validates empty fields without calling the server', async () => {
    const user = userEvent.setup();
    renderAt();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(mocks.signInWithEmail).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Email address'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('submits the typed credentials', async () => {
    const user = userEvent.setup();
    mocks.signInWithEmail.mockResolvedValue({ ok: true });
    renderAt();

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mocks.signInWithEmail).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'Secret-pass-1',
    });
  });

  it('shows the generic error, clears the password and refocuses it', async () => {
    const user = userEvent.setup();
    mocks.signInWithEmail.mockResolvedValue({
      ok: false,
      error: { code: 'invalid_credentials', message: 'Incorrect email or password.' },
    });
    renderAt();

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email address')).toHaveValue('me@example.com');
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveFocus());
  });

  it('ignores a second submit while the first is running', async () => {
    const user = userEvent.setup();
    mocks.signInWithEmail.mockReturnValue(new Promise(() => {}));
    renderAt();

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    await user.keyboard('{Enter}');

    expect(mocks.signInWithEmail).toHaveBeenCalledTimes(1);
  });

  it('offers to resend the confirmation email when the account is unconfirmed', async () => {
    const user = userEvent.setup();
    mocks.signInWithEmail.mockResolvedValue({
      ok: false,
      error: { code: 'email_not_confirmed', message: 'Please confirm your email address first.' },
    });
    mocks.resendSignupEmail.mockResolvedValue({ ok: true });
    renderAt();

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(await screen.findByRole('button', { name: 'Resend confirmation email' }));

    expect(mocks.resendSignupEmail).toHaveBeenCalledWith('me@example.com');
    expect(await screen.findByText(/If this email isn't confirmed yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend confirmation in \d+s/ })).toBeDisabled();
  });

  it('goes to the allow-listed redirect once authenticated', () => {
    mocks.auth.status = 'authenticated';
    renderAt('/login?redirect=shipping');
    expect(screen.getByTestId('where')).toHaveTextContent('/shipping');
  });

  it('ignores an unsafe redirect and goes home', () => {
    mocks.auth.status = 'authenticated';
    renderAt('/login?redirect=https://evil.example');
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });

  it('sends admins to /admin', () => {
    mocks.auth.status = 'authenticated';
    mocks.auth.isAdmin = true;
    renderAt('/login?redirect=shipping');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin');
  });

  it('does not navigate while the session is still loading', () => {
    mocks.auth.status = 'loading';
    renderAt();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });
});
