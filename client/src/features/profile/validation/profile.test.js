import { describe, expect, it } from 'vitest';

import { initialProfileValues, profileSchema, toProfileRow } from './profile';

const valid = {
  fullName: 'Sam Lee',
  phone: '+1 (555) 010-0000',
  address: '1 Test Street',
  state: 'Lagos State',
  city: 'Capital District',
};

/** The message the form shows for each field: the first problem found for it. */
const errorsOf = (values) => {
  const result = profileSchema.safeParse(values);
  const errors = {};
  if (!result.success) {
    for (const issue of result.error.issues) errors[issue.path[0]] ??= issue.message;
  }
  return errors;
};

describe('profileSchema', () => {
  it('accepts a complete profile and trims the text', () => {
    const result = profileSchema.parse({
      ...valid,
      fullName: '  Sam Lee  ',
      address: ' 1 Test Street ',
    });
    expect(result).toMatchObject({ fullName: 'Sam Lee', address: '1 Test Street' });
  });

  it('accepts a profile with only a name (phone and address are optional)', () => {
    expect(
      profileSchema.safeParse({ fullName: 'Sam Lee', phone: '', address: '', state: '', city: '' })
        .success,
    ).toBe(true);
  });

  it('needs a real name', () => {
    expect(errorsOf({ ...valid, fullName: '' }).fullName).toMatch(/Enter your full name/);
    expect(errorsOf({ ...valid, fullName: ' a ' }).fullName).toMatch(/at least 2/);
    expect(errorsOf({ ...valid, fullName: 'x'.repeat(101) }).fullName).toMatch(/100 characters/);
    expect(errorsOf({ ...valid, fullName: 'Sam\u0000Lee' }).fullName).toMatch(/invalid characters/);
  });

  it('checks the phone: allowed characters, enough digits, not too long', () => {
    expect(errorsOf({ ...valid, phone: 'call me' }).phone).toMatch(/only digits/);
    expect(errorsOf({ ...valid, phone: '12345' }).phone).toMatch(/at least 7 digits/);
    expect(errorsOf({ ...valid, phone: '1'.repeat(33) }).phone).toMatch(/32 characters/);
    expect(errorsOf({ ...valid, phone: '' }).phone).toBeUndefined();
  });

  it('limits the address to what the database allows', () => {
    expect(errorsOf({ ...valid, address: 'a'.repeat(301) }).address).toMatch(/300 characters/);
    expect(errorsOf({ ...valid, address: 'a'.repeat(300) }).address).toBeUndefined();
  });

  it('only accepts a state and a city from the lists', () => {
    expect(errorsOf({ ...valid, state: 'Narnia', city: '' }).state).toMatch(/from the list/);
    expect(errorsOf({ ...valid, city: 'Gotham' }).city).toMatch(/from the list/);
    // A city of another state is not valid for this one.
    expect(errorsOf({ ...valid, state: 'Lagos State', city: 'Azare' }).city).toMatch(
      /from the list/,
    );
    // A city without a state is not valid either.
    expect(errorsOf({ ...valid, state: '', city: 'Capital District' }).city).toMatch(
      /from the list/,
    );
  });

  it('accepts the Bauchi hub with one of its own cities', () => {
    expect(
      profileSchema.safeParse({
        ...valid,
        state: 'Bauchi State (Primary Local Hub)',
        city: 'Azare',
      }).success,
    ).toBe(true);
  });
});

describe('initialProfileValues', () => {
  it('turns missing values into empty text so inputs stay controlled', () => {
    expect(initialProfileValues(null)).toEqual({
      fullName: '',
      phone: '',
      address: '',
      state: '',
      city: '',
    });
    expect(
      initialProfileValues({
        fullName: 'Sam',
        phone: null,
        defaultAddress: '1 St',
        defaultState: 'Lagos State',
        defaultCity: null,
      }),
    ).toEqual({ fullName: 'Sam', phone: '', address: '1 St', state: 'Lagos State', city: '' });
  });
});

describe('toProfileRow', () => {
  it('sends exactly the five editable columns', () => {
    expect(toProfileRow(valid)).toEqual({
      full_name: 'Sam Lee',
      phone: '+1 (555) 010-0000',
      default_address: '1 Test Street',
      default_state: 'Lagos State',
      default_city: 'Capital District',
    });
    expect(Object.keys(toProfileRow(valid)).sort()).toEqual([
      'default_address',
      'default_city',
      'default_state',
      'full_name',
      'phone',
    ]);
  });

  it('turns empty fields into NULL, never an empty string', () => {
    expect(toProfileRow({ fullName: 'Sam', phone: ' ', address: '', state: '', city: '' })).toEqual(
      {
        full_name: 'Sam',
        phone: null,
        default_address: null,
        default_state: null,
        default_city: null,
      },
    );
  });

  it('drops a city that has no state', () => {
    expect(toProfileRow({ ...valid, state: '' }).default_city).toBeNull();
  });
});
