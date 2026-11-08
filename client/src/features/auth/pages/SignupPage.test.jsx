import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  signUpWithEmail: vi.fn(),
  resendSignupEmail: vi.fn(),
  confirmSignupEmail: vi.fn(),
}));

vi.mock('../services/signupService', () => ({
  ...service,
  CONFIRM_TOKEN_TYPES: ['email', 'signup'],
}));

import SignupPage from './SignupPage';

const PASSWORD = 'Kq7mWz2xPv9L';

function renderPage(entry = '/signup') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SignupPage />
    </MemoryRouter>,
  );
}

async function fillValidForm(user, { password = PASSWORD, confirm = PASSWORD } = {}) {
  await user.type(screen.getByLabelText('Full name'), 'Ayesha Khan');
  await user.type(screen.getByLabelText('Email address'), 'ayesha@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('checkbox'));
}

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe('SignupPage: form', () => {
  it('renders every field, the terms checkbox and a brand-blue submit button', () => {
    renderPage();

    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    const submit = screen.getByRole('button', { name: /create account/i });
    expect(submit.className).toContain('bg-blue-600');
    expect(submit.className).not.toMatch(/orange/);
  });

  it('uses the right autocomplete hints', () => {
    renderPage();
    expect(screen.getByLabelText('Full name')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('opens the legal pages in a new tab safely', () => {
    renderPage();
    for (const [name, href] of [
      ['Terms of Service', '/terms'],
      ['Privacy Policy', '/privacy'],
    ]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('shows every problem on an empty submit, focuses the first, and does not call the server', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument();
    expect(screen.getByText(/must accept the Terms/)).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveFocus();
    expect(service.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('rejects a weak password with the requirement text', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user, { password: 'abcdefghijkl', confirm: 'abcdefghijkl' });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      /at least 12 characters/i,
    );
    expect(service.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('rejects mismatching passwords', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user, { confirm: 'Different12345' });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getAllByText("Passwords don't match.").length).toBeGreaterThan(0);
    expect(service.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('requires the terms checkbox', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('checkbox')); // untick

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/must accept the Terms/)).toBeInTheDocument();
    expect(service.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows the strength meter and checklist while typing the password', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByText(/password strength/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Fair');
  });

  it('shares one eye toggle between password and confirm password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: 'Show password' })[0]);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text');
  });
});

describe('SignupPage: submitting', () => {
  it('sends the trimmed values and the terms version, then shows "Check your email"', async () => {
    const user = userEvent.setup();
    service.signUpWithEmail.mockResolvedValue({ ok: true });
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(service.signUpWithEmail).toHaveBeenCalledTimes(1);
    expect(service.signUpWithEmail).toHaveBeenCalledWith({
      fullName: 'Ayesha Khan',
      email: 'ayesha@example.com',
      password: PASSWORD,
      termsAccepted: true,
      termsVersion: 'draft-0',
    });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/ayesha@example\.com/)).toBeInTheDocument();
  });

  it('starts the resend cooldown straight away', async () => {
    const user = userEvent.setup();
    service.signUpWithEmail.mockResolvedValue({ ok: true });
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('button', { name: /Resend email in \d+s/ })).toBeDisabled();
  });

  it('shows a loading state and ignores a second submit while the first is running', async () => {
    const user = userEvent.setup();
    service.signUpWithEmail.mockReturnValue(new Promise(() => {}));
    renderPage();
    await fillValidForm(user);

    const submit = screen.getByRole('button', { name: /create account/i });
    await user.click(submit);

    const busy = screen.getByRole('button', { name: /creating account/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy);
    await user.keyboard('{Enter}');
    expect(service.signUpWithEmail).toHaveBeenCalledTimes(1);
  });

  it('shows a server error in an alert and keeps what the user typed', async () => {
    const user = userEvent.setup();
    service.signUpWithEmail.mockResolvedValue({
      ok: false,
      error: {
        code: 'network',
        message: "Can't reach the server. Check your internet connection and try again.",
      },
    });
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
    expect(screen.getByLabelText('Email address')).toHaveValue('ayesha@example.com');
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  it('puts a server-side weak-password rejection on the password field', async () => {
    const user = userEvent.setup();
    service.signUpWithEmail.mockResolvedValue({
      ok: false,
      error: { code: 'weak_password', message: "That password doesn't meet the requirements." },
    });
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText("That password doesn't meet the requirements."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('"Use a different email" returns to the form, keeping the name and email but not the passwords', async () => {
    const user = userEvent.setup();
    service.signUpWithEmail.mockResolvedValue({ ok: true });
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(screen.getByLabelText('Email address')).toHaveValue('ayesha@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm password')).toHaveValue('');
  });
});

describe('SignupPage: sign-in link and redirect safety', () => {
  it('links to login', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('keeps an allowed redirect for the legacy login page', () => {
    renderPage('/signup?redirect=shipping');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=shipping',
    );
  });

  it.each(['https://evil.com', '//evil.com', 'javascript:alert(1)', '/not-allowed'])(
    'drops the unsafe redirect %s',
    (bad) => {
      renderPage(`/signup?redirect=${encodeURIComponent(bad)}`);
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    },
  );
});
