import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth } }));

import {
  cancelRecoverySession,
  requestPasswordReset,
  updatePassword,
  verifyRecoveryToken,
} from './passwordService';

const GOOD = 'Kq7mWz2xPv9L';

beforeEach(() => {
  vi.resetAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
});

describe('requestPasswordReset', () => {
  it('sends a normalized email with our reset page as the redirect', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await expect(requestPasswordReset('  Ayesha@Example.COM ')).resolves.toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ayesha@example.com', {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
  });

  it('rejects an invalid address without contacting Supabase', async () => {
    const result = await requestPasswordReset('nope');
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_email' } });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('returns the same result whether or not the address exists', async () => {
    // Supabase answers an unknown address with success and no email.
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const known = await requestPasswordReset('known@example.com');
    const unknown = await requestPasswordReset('unknown@example.com');
    expect(known).toEqual(unknown);
  });

  it('hides the per-address throttle, which would reveal that an account exists', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    await expect(requestPasswordReset('known@example.com')).resolves.toEqual({ ok: true });

    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    await expect(requestPasswordReset('known@example.com')).resolves.toEqual({ ok: true });
  });

  it('still reports problems that do not depend on the address', async () => {
    auth.resetPasswordForEmail.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await requestPasswordReset('a@b.com')).error.code).toBe('network');

    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { code: 'unexpected_failure' },
    });
    expect((await requestPasswordReset('a@b.com')).error.code).toBe('unknown');
  });
});

describe('verifyRecoveryToken', () => {
  it('verifies with the type fixed to "recovery"', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });

    await expect(verifyRecoveryToken('abc123')).resolves.toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' });
  });

  it('does not sign the user out on success (the form needs the recovery session)', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    await verifyRecoveryToken('abc123');
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it.each(['', undefined, null, 42])('refuses %j without contacting Supabase', async (bad) => {
    const result = await verifyRecoveryToken(bad);
    expect(result).toMatchObject({ ok: false, error: { code: 'link_expired' } });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('reports an expired or already-used token', async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired', status: 403 } });
    const result = await verifyRecoveryToken('abc123');
    expect(result).toMatchObject({ ok: false, error: { code: 'link_expired' } });
  });

  it('reports network failures', async () => {
    auth.verifyOtp.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await verifyRecoveryToken('abc123')).error.code).toBe('network');
  });
});

describe('updatePassword', () => {
  it('updates the password, then ends all sessions everywhere', async () => {
    const order = [];
    auth.updateUser.mockImplementation(async () => {
      order.push('update');
      return { data: {}, error: null };
    });
    auth.signOut.mockImplementation(async () => {
      order.push('signOut');
      return { error: null };
    });

    await expect(updatePassword(GOOD)).resolves.toEqual({ ok: true, otherSessionsRevoked: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: GOOD });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(order).toEqual(['update', 'signOut']);
  });

  it('never calls Supabase with a password that breaks the rules', async () => {
    for (const bad of ['', 'short', 'abcdefghijkl', 'ABCDEFGHIJKL1']) {
      const result = await updatePassword(bad);
      expect(result).toMatchObject({ ok: false, error: { code: 'weak_password' } });
    }
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('maps a server-side rejection and does not sign out', async () => {
    auth.updateUser.mockResolvedValue({
      data: null,
      error: { code: 'same_password', status: 422 },
    });
    const result = await updatePassword(GOOD);
    expect(result).toMatchObject({ ok: false, error: { code: 'same_password' } });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('treats a missing or expired recovery session as an expired link', async () => {
    auth.updateUser.mockResolvedValue({
      data: null,
      error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
    });
    expect((await updatePassword(GOOD)).error.code).toBe('link_expired');
  });

  it('reports network failures', async () => {
    auth.updateUser.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await updatePassword(GOOD)).error.code).toBe('network');
  });

  it('still succeeds, and signs out locally, if ending other sessions fails', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    auth.signOut.mockImplementation(async ({ scope }) =>
      scope === 'global' ? { error: { message: 'boom' } } : { error: null },
    );

    await expect(updatePassword(GOOD)).resolves.toEqual({ ok: true, otherSessionsRevoked: false });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('handles a thrown error from the global sign-out the same way', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    auth.signOut.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ error: null });

    await expect(updatePassword(GOOD)).resolves.toEqual({ ok: true, otherSessionsRevoked: false });
  });

  it('does not log or return the password', async () => {
    const spies = ['log', 'warn', 'error', 'info'].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const result = await updatePassword(GOOD);

    expect(JSON.stringify(result)).not.toContain(GOOD);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(GOOD);
  });
});

describe('cancelRecoverySession', () => {
  it('drops only the local session', async () => {
    await cancelRecoverySession();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('never throws', async () => {
    auth.signOut.mockRejectedValue(new Error('storage blocked'));
    await expect(cancelRecoverySession()).resolves.toBeUndefined();
  });
});
