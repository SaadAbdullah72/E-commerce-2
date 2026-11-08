import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth } }));

import { completeOAuthCallback, consumeOAuthRedirect, signInWithGoogle } from './oauthService';

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});

describe('signInWithGoogle', () => {
  it('always sends Google back to our own /auth/callback', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null });

    expect(await signInWithGoogle('/shipping')).toEqual({ ok: true });

    const args = auth.signInWithOAuth.mock.calls[0][0];
    expect(args.provider).toBe('google');
    expect(args.options.redirectTo).toBe(`${window.location.origin}/auth/callback`);
  });

  it('remembers only an allow-listed destination, outside the URL', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null });

    await signInWithGoogle('shipping');
    expect(consumeOAuthRedirect()).toBe('/shipping');

    await signInWithGoogle('https://evil.example');
    expect(consumeOAuthRedirect()).toBe('/');
    expect(auth.signInWithOAuth.mock.calls[1][0].options.redirectTo).not.toContain('evil');
  });

  it('consumes the remembered destination only once', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    await signInWithGoogle('/orders');

    expect(consumeOAuthRedirect()).toBe('/orders');
    expect(consumeOAuthRedirect()).toBe('/');
  });

  it('returns a safe message when Supabase fails or the network is down', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({
      error: { code: 'provider_disabled', status: 400, message: 'raw internals' },
    });
    const failed = await signInWithGoogle();
    expect(failed.ok).toBe(false);
    expect(JSON.stringify(failed)).not.toContain('raw internals');

    auth.signInWithOAuth.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await signInWithGoogle()).toMatchObject({ ok: false, error: { code: 'network' } });
  });
});

describe('completeOAuthCallback', () => {
  it('succeeds when the client has a session after processing the code', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    expect(await completeOAuthCallback({ hasCode: true, error: null })).toEqual({ ok: true });
  });

  it('fails when there is no session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await completeOAuthCallback({ hasCode: true, error: null })).toEqual({
      ok: false,
      code: 'failed',
    });
  });

  it('treats access_denied as the user cancelling, without asking Supabase', async () => {
    expect(await completeOAuthCallback({ hasCode: false, error: 'access_denied' })).toEqual({
      ok: false,
      code: 'cancelled',
    });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it('fails for any other provider error and for a direct visit with no code', async () => {
    expect(await completeOAuthCallback({ hasCode: false, error: 'server_error' })).toMatchObject({
      code: 'failed',
    });
    expect(await completeOAuthCallback({ hasCode: false, error: null })).toMatchObject({
      code: 'failed',
    });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it('fails instead of throwing when getSession rejects', async () => {
    auth.getSession.mockRejectedValue(new Error('boom'));
    expect(await completeOAuthCallback({ hasCode: true, error: null })).toMatchObject({
      ok: false,
    });
  });
});
