import { describe, expect, it } from 'vitest';

import {
  normalizeEmail,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateSignupForm,
  validateTerms,
} from './signup';

const valid = {
  fullName: 'Ayesha Khan',
  email: 'ayesha@example.com',
  password: 'Abcdefghij12',
  confirmPassword: 'Abcdefghij12',
  termsAccepted: true,
};

describe('validateFullName', () => {
  it.each([
    ['', 'Enter your full name.'],
    ['   ', 'Enter your full name.'],
    ['A', 'Use at least 2 characters.'],
    ['x'.repeat(101), 'Use 100 characters or fewer.'],
    ['Bad\u0000Name', 'Your name contains invalid characters.'],
  ])('rejects %j', (name, message) => {
    expect(validateFullName(name)).toBe(message);
  });

  it('accepts a normal name and ignores surrounding spaces', () => {
    expect(validateFullName('  Ayesha Khan ')).toBeNull();
  });
});

describe('validateEmail / normalizeEmail', () => {
  it.each(['', 'plain', 'a@b', 'a b@c.com', '@c.com', 'a@@c.com'])('rejects %j', (email) => {
    expect(validateEmail(email)).not.toBeNull();
  });

  it('rejects an email longer than 254 characters', () => {
    expect(validateEmail(`${'a'.repeat(250)}@x.com`)).not.toBeNull();
  });

  it('accepts a normal email, including plus-addressing', () => {
    expect(validateEmail('name+tag@gmail.com')).toBeNull();
  });

  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Name@Example.COM ')).toBe('name@example.com');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('validateConfirmPassword', () => {
  it('requires a value', () => {
    expect(validateConfirmPassword('Abcdefghij12', '')).toBe('Confirm your password.');
  });

  it('flags a mismatch with the exact message the UI shows', () => {
    expect(validateConfirmPassword('Abcdefghij12', 'Abcdefghij13')).toBe("Passwords don't match.");
  });

  it('accepts a match', () => {
    expect(validateConfirmPassword('Abcdefghij12', 'Abcdefghij12')).toBeNull();
  });
});

describe('validateTerms', () => {
  it('requires exactly true', () => {
    expect(validateTerms(true)).toBeNull();
    expect(validateTerms(false)).not.toBeNull();
    expect(validateTerms('true')).not.toBeNull();
    expect(validateTerms(undefined)).not.toBeNull();
  });
});

describe('validateSignupForm', () => {
  it('accepts a fully valid form', () => {
    expect(validateSignupForm(valid)).toEqual({ valid: true, errors: {} });
  });

  it('collects every error at once', () => {
    const result = validateSignupForm({
      fullName: '',
      email: 'nope',
      password: 'weak',
      confirmPassword: 'other',
      termsAccepted: false,
    });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(
      ['confirmPassword', 'email', 'fullName', 'password', 'terms'].sort(),
    );
  });

  it('reports only the field that is wrong', () => {
    const result = validateSignupForm({ ...valid, confirmPassword: 'Different12345' });
    expect(Object.keys(result.errors)).toEqual(['confirmPassword']);
  });
});
