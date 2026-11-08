import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth } }));

import {
  EMAIL_NOT_CONFIRMED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  signInWithEmail,
} from './loginService';

beforeEach(() => vi.resetAllMocks());

describe('signInWithEmail', () => {
  it('signs in with a normalised email and the password untouched', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });

    const result = await signInWithEmail({ email: '  Me@Example.com ', password: ' pass word ' });

    expect(result).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: ' pass word ',
    });
  });

  it('does not call Supabase for an invalid email or an empty password', async () => {
    expect((await signInWithEmail({ email: 'nope', password: 'x' })).ok).toBe(false);
    const empty = await signInWithEmail({ email: 'a@b.co', password: '' });
    expect(empty).toMatchObject({ ok: false, error: { code: 'missing_password' } });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not apply signup password-strength rules to existing accounts', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect((await signInWithEmail({ email: 'a@b.co', password: 'short' })).ok).toBe(true);
  });

  it('gives wrong-password and unknown-account the same message (no enumeration)', async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    });

    const result = await signInWithEmail({ email: 'a@b.co', password: 'whatever' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_credentials', message: INVALID_CREDENTIALS_MESSAGE },
    });
  });

  it('reports an unconfirmed email', async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' },
    });

    const result = await signInWithEmail({ email: 'a@b.co', password: 'x' });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'email_not_confirmed', message: EMAIL_NOT_CONFIRMED_MESSAGE },
    });
  });

  it('maps rate limits and network failures without raw server text', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { code: 'over_request_rate_limit', status: 429, message: 'secret internals' },
    });
    const limited = await signInWithEmail({ email: 'a@b.co', password: 'x' });
    expect(limited).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
    expect(JSON.stringify(limited)).not.toContain('secret internals');

    auth.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await signInWithEmail({ email: 'a@b.co', password: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'network' },
    });
  });
});
