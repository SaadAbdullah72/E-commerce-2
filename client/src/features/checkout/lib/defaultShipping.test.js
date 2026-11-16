import { describe, expect, it } from 'vitest';

import {
  BAUCHI_EXCLUSIVE_COURIER,
  BAUCHI_STATE,
  citiesForState,
} from '@/shared/constants/locations';

import { shippingDefaultsFromAccount } from './defaultShipping';

describe('shippingDefaultsFromAccount', () => {
  it('uses the saved phone and address, state and city', () => {
    expect(
      shippingDefaultsFromAccount({
        phone: '+10000000000',
        defaultAddress: '1 Test Street',
        defaultState: 'Lagos State',
        defaultCity: 'Capital District',
      }),
    ).toEqual({
      phone: '+10000000000',
      address: '1 Test Street',
      state: 'Lagos State',
      city: 'Capital District',
      courier: '',
    });
  });

  it('is all empty when there is no account or nothing saved', () => {
    const empty = { phone: '', address: '', state: '', city: '', courier: '' };
    expect(shippingDefaultsFromAccount(null)).toEqual(empty);
    expect(shippingDefaultsFromAccount(undefined)).toEqual(empty);
    expect(shippingDefaultsFromAccount({})).toEqual(empty);
  });

  it('leaves out a state that is not a choice, and a city that does not belong to the state', () => {
    expect(shippingDefaultsFromAccount({ defaultState: 'Narnia', defaultCity: 'X' })).toMatchObject(
      {
        state: '',
        city: '',
      },
    );
    expect(
      shippingDefaultsFromAccount({ defaultState: 'Lagos State', defaultCity: 'Azare' }),
    ).toMatchObject({ state: 'Lagos State', city: '' });
  });

  it('picks the local courier for the Bauchi hub, as choosing that state does', () => {
    const [city] = citiesForState(BAUCHI_STATE);
    expect(
      shippingDefaultsFromAccount({ defaultState: BAUCHI_STATE, defaultCity: city }),
    ).toMatchObject({ state: BAUCHI_STATE, city, courier: BAUCHI_EXCLUSIVE_COURIER });
  });
});
