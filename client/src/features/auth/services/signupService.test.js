import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth } }));

import { confirmSignupEmail, resendSignupEmail, signUpWithEmail } from './signupService';

const input = {
  fullName: '  Ayesha Khan ',
  email: '  Ayesha@Example.COM ',
  password: 'Abcdefghij12',
  termsAccepted: true,
  termsVersion: 'draft-0',
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
});

describe('signUpWithEmail', () => {
  it('sends a normalized email, trimmed name and metadata, and never a role', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: '1' }, session: null }, error: null });

    await signUpWithEmail(input);

    expect(auth.signUp).toHaveBeenCalledTimes(1);
    const arg = auth.signUp.mock.calls[0][0];
    expect(arg.email).toBe('ayesha@example.com');
    expect(arg.password).toBe('Abcdefghij12');
    expect(arg.options.emailRedirectTo).toBe(`${window.location.origin}/auth/confirm`);
    expect(arg.options.data).toEqual({
      full_name: 'Ayesha Khan',
      terms_accepted: true,
      terms_version: 'draft-0',
    });
    expect(JSON.stringify(arg)).not.toMatch(/role|admin/i);
  });

  it('returns ok for a new account', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: '1' }, session: null }, error: null });
    await expect(signUpWithEmail(input)).resolves.toEqual({ ok: true });
  });

  it('returns the identical result when the address was already registered', async () => {
    // Supabase answers a duplicate with a look-alike user whose identities array is empty.
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'fake', identities: [] }, session: null },
      error: null,
    });
    const duplicate = await signUpWithEmail(input);

    auth.signUp.mockResolvedValue({
      data: { user: { id: '1', identities: [{}] }, session: null },
      error: null,
    });
    const fresh = await signUpWithEmail(input);

    expect(duplicate).toEqual(fresh);
    expect(duplicate).toEqual({ ok: true });
  });

  it('treats an explicit "already registered" error as success too', async () => {
    auth.signUp.mockResolvedValue({ data: null, error: { code: 'user_already_exists' } });
    await expect(signUpWithEmail(input)).resolves.toEqual({ ok: true });

    auth.signUp.mockResolvedValue({ data: null, error: { code: 'email_exists' } });
    await expect(signUpWithEmail(input)).resolves.toEqual({ ok: true });
  });

  it('maps a weak-password rejection from the server', async () => {
    auth.signUp.mockResolvedValue({ data: null, error: { code: 'weak_password', status: 422 } });
    const result = await signUpWithEmail(input);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('weak_password');
  });

  it('maps rate limits and network failures', async () => {
    auth.signUp.mockResolvedValue({
      data: null,
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    expect((await signUpWithEmail(input)).error.code).toBe('rate_limited');

    auth.signUp.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await signUpWithEmail(input)).error.code).toBe('network');
  });

  it('never calls Supabase when the input is invalid', async () => {
    for (const bad of [
      { ...input, password: 'short' },
      { ...input, email: 'nope' },
      { ...input, fullName: '' },
      { ...input, termsAccepted: false },
    ]) {
      const result = await signUpWithEmail(bad);
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    }
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('drops a session if Supabase unexpectedly returns one (Confirm email OFF)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    auth.signUp.mockResolvedValue({
      data: { user: {}, session: { access_token: 'x' } },
      error: null,
    });

    await expect(signUpWithEmail(input)).resolves.toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Abcdefghij12');
  });
});

describe('resendSignupEmail', () => {
  it('asks Supabase to resend a signup email for the normalized address', async () => {
    auth.resend.mockResolvedValue({ error: null });

    await expect(resendSignupEmail('  Ayesha@Example.COM ')).resolves.toEqual({ ok: true });
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ayesha@example.com',
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
  });

  it('reports rate limits so the user knows to wait', async () => {
    auth.resend.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    const result = await resendSignupEmail('a@b.com');
    expect(result).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
  });

  it('looks like success for unknown or already-registered addresses', async () => {
    for (const code of ['user_not_found', 'user_already_exists', 'email_exists']) {
      auth.resend.mockResolvedValue({ error: { code } });
      await expect(resendSignupEmail('a@b.com')).resolves.toEqual({ ok: true });
    }
  });

  it('reports network failures', async () => {
    auth.resend.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await resendSignupEmail('a@b.com');
    expect(result.error.code).toBe('network');
  });
});

describe('confirmSignupEmail', () => {
  it('verifies the token hash, then drops the local session', async () => {
    const order = [];
    auth.verifyOtp.mockImplementation(async () => {
      order.push('verify');
      return { error: null };
    });
    auth.signOut.mockImplementation(async () => {
      order.push('signOut');
      return { error: null };
    });

    await expect(confirmSignupEmail({ tokenHash: 'abc', type: 'email' })).resolves.toEqual({
      ok: true,
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(order).toEqual(['verify', 'signOut']);
  });

  it('still succeeds if the local sign-out throws (the email IS verified)', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    auth.signOut.mockRejectedValue(new Error('storage blocked'));
    await expect(confirmSignupEmail({ tokenHash: 'abc', type: 'signup' })).resolves.toEqual({
      ok: true,
    });
  });

  it('reports an expired or used link and does not sign out', async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired', status: 403 } });
    const result = await confirmSignupEmail({ tokenHash: 'abc', type: 'email' });
    expect(result).toMatchObject({ ok: false, error: { code: 'link_expired' } });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it.each([
    [{ tokenHash: '', type: 'email' }],
    [{ tokenHash: 'abc', type: '' }],
    [{ tokenHash: 'abc', type: 'recovery' }],
    [{ tokenHash: 'abc', type: 'magiclink' }],
    [{ tokenHash: 'abc', type: 'email_change' }],
  ])('refuses %j without contacting Supabase', async (args) => {
    const result = await confirmSignupEmail(args);
    expect(result).toMatchObject({ ok: false, error: { code: 'link_expired' } });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('reports network failures', async () => {
    auth.verifyOtp.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await confirmSignupEmail({ tokenHash: 'abc', type: 'email' });
    expect(result.error.code).toBe('network');
  });
});
