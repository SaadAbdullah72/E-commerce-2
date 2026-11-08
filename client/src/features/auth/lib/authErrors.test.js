import { describe, expect, it } from 'vitest';

import { isAlreadyRegisteredError, mapAuthError } from './authErrors';

describe('mapAuthError', () => {
  it.each([
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, 'network'],
    [new TypeError('Failed to fetch'), 'network'],
    [{ status: 0, message: 'x' }, 'network'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rate_limited'],
    [{ code: 'over_request_rate_limit' }, 'rate_limited'],
    [{ status: 429 }, 'rate_limited'],
    [{ code: 'weak_password', status: 422 }, 'weak_password'],
    [{ code: 'same_password', status: 422 }, 'same_password'],
    [{ code: 'email_address_invalid' }, 'invalid_email'],
    [{ code: 'otp_expired', status: 403 }, 'link_expired'],
    [{ code: 'flow_state_expired' }, 'link_expired'],
    [{ code: 'signup_disabled' }, 'signup_disabled'],
    [{ code: 'something_new' }, 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown'],
  ])('maps %j to %s', (error, code) => {
    expect(mapAuthError(error).code).toBe(code);
  });

  it('always returns a non-empty user-facing message', () => {
    expect(mapAuthError({ code: 'weak_password' }).message).toMatch(/12 characters/);
    expect(mapAuthError({ code: 'otp_expired' }).message).toMatch(/expired/);
  });

  it('never exposes the raw server message', () => {
    const { message } = mapAuthError({ code: 'database_error', message: 'secret internal detail' });
    expect(message).not.toContain('secret');
    expect(message).toBe('Something went wrong. Please try again.');
  });

  it('never mentions that an account exists', () => {
    for (const code of ['user_already_exists', 'email_exists', 'user_not_found']) {
      expect(mapAuthError({ code }).message).not.toMatch(/exist|registered|already|found/i);
    }
  });
});

describe('isAlreadyRegisteredError', () => {
  it('detects the duplicate-account codes so callers can hide them', () => {
    expect(isAlreadyRegisteredError({ code: 'user_already_exists' })).toBe(true);
    expect(isAlreadyRegisteredError({ code: 'email_exists' })).toBe(true);
    expect(isAlreadyRegisteredError({ code: 'weak_password' })).toBe(false);
    expect(isAlreadyRegisteredError(null)).toBe(false);
  });
});
