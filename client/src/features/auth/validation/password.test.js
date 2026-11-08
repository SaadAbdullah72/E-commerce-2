import { describe, expect, it } from 'vitest';

import {
  getPasswordError,
  getPasswordStrength,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from './password';

describe('validatePassword', () => {
  it('accepts a password with 12+ characters, upper, lower and a digit', () => {
    expect(validatePassword('Abcdefghij12')).toEqual({
      valid: true,
      failedRules: [],
      tooLong: false,
    });
  });

  it('does not require a symbol (matches the Supabase dashboard setting)', () => {
    expect(validatePassword('Kq7mWz2xPv9L').valid).toBe(true);
  });

  it.each([
    ['abcdefghijkl', ['uppercase', 'digit']],
    ['ABCDEFGHIJKL', ['lowercase', 'digit']],
    ['Abcdefghijkl', ['digit']],
    ['Short1', ['length']],
    ['', ['length', 'lowercase', 'uppercase', 'digit']],
  ])('rejects %j and reports the failed rules', (password, failed) => {
    const result = validatePassword(password);
    expect(result.valid).toBe(false);
    expect(result.failedRules).toEqual(failed);
  });

  it('treats non-strings as empty', () => {
    expect(validatePassword(undefined).valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
  });

  it('accepts exactly the maximum byte length and rejects one byte more', () => {
    const atLimit = `Aa1${'x'.repeat(PASSWORD_MAX_BYTES - 3)}`;
    expect(validatePassword(atLimit).valid).toBe(true);
    const overLimit = `${atLimit}x`;
    const result = validatePassword(overLimit);
    expect(result.tooLong).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('counts bytes, not characters, for the limit', () => {
    // Each "é" is 2 bytes in UTF-8: 36 characters = 72 bytes + "Aa1" pushes it over.
    const multibyte = `Aa1${'é'.repeat(36)}`;
    expect(validatePassword(multibyte).tooLong).toBe(true);
  });
});

describe('getPasswordError', () => {
  it('returns null for a valid password', () => {
    expect(getPasswordError('Abcdefghij12')).toBeNull();
  });

  it('asks for a password when empty', () => {
    expect(getPasswordError('')).toBe('Enter a password.');
  });

  it('describes the requirements for a weak password', () => {
    expect(getPasswordError('abc')).toContain(`${PASSWORD_MIN_LENGTH} characters`);
  });

  it('mentions the length limit for an over-long password', () => {
    expect(getPasswordError(`Aa1${'x'.repeat(PASSWORD_MAX_BYTES)}`)).toContain(
      String(PASSWORD_MAX_BYTES),
    );
  });
});

describe('getPasswordStrength', () => {
  it('scores an empty password 0 with no label', () => {
    expect(getPasswordStrength('')).toEqual({ score: 0, label: '' });
  });

  it('never rates a password that fails the rules above Weak', () => {
    expect(getPasswordStrength('abcdefghijklmnopqrstuvwxyz').score).toBe(1);
    expect(getPasswordStrength('Short1').score).toBe(1);
  });

  it('rates a minimal valid password Fair', () => {
    expect(getPasswordStrength('Kq7mWz2xPv9L')).toEqual({ score: 2, label: 'Fair' });
  });

  it('rates a longer valid password Good', () => {
    expect(getPasswordStrength('Kq7mWz2xPv9LbN4t')).toEqual({ score: 3, label: 'Good' });
  });

  it('rates a long mixed password Strong', () => {
    expect(getPasswordStrength('Tr0ub4dor&3xylophone')).toEqual({ score: 4, label: 'Strong' });
  });

  it('penalizes common passwords even when they satisfy the rules', () => {
    expect(getPasswordStrength('Password12345!')).toEqual({ score: 1, label: 'Weak' });
  });

  it('penalizes sequences such as abcdefghij', () => {
    expect(getPasswordStrength('Abcdefghij12').score).toBe(1);
  });

  it('penalizes repeated characters', () => {
    expect(getPasswordStrength('Aaaaaaaaaaa1').score).toBe(1);
  });

  it('lowers the score when the password contains personal details', () => {
    const base = getPasswordStrength('Kq7mWz2xPv9Lnoorul').score;
    const withContext = getPasswordStrength('Kq7mWz2xPv9Lnoorul', { personal: ['noorul'] }).score;
    expect(withContext).toBeLessThan(base);
  });

  it('ignores personal tokens shorter than 3 characters', () => {
    const base = getPasswordStrength('Kq7mWz2xPv9Lbn').score;
    expect(getPasswordStrength('Kq7mWz2xPv9Lbn', { personal: ['bn'] }).score).toBe(base);
  });
});
