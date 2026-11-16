import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { fetchAccount } from './sessionService';

const USER = 'u1';

/** from('profiles') and from('user_roles') each end in maybeSingle(). */
function answer({ profile, role }) {
  const selects = {};
  supabase.from.mockImplementation((table) => ({
    select: (columns) => {
      selects[table] = columns;
      return {
        eq: () => ({ maybeSingle: () => Promise.resolve(table === 'profiles' ? profile : role) }),
      };
    },
  }));
  return selects;
}

beforeEach(() => supabase.from.mockReset());

describe('fetchAccount', () => {
  it('reads the profile (with the default address) and the role', async () => {
    const selects = answer({
      profile: {
        data: {
          full_name: 'Sam Lee',
          phone: '+1',
          default_address: '1 St',
          default_city: 'City',
          default_state: 'State',
        },
        error: null,
      },
      role: { data: { role: 'admin' }, error: null },
    });

    expect(await fetchAccount(USER)).toEqual({
      userId: USER,
      role: 'admin',
      fullName: 'Sam Lee',
      phone: '+1',
      defaultAddress: '1 St',
      defaultCity: 'City',
      defaultState: 'State',
      profileMissing: false,
      loadFailed: false,
    });
    expect(selects.profiles).toBe('full_name, phone, default_address, default_city, default_state');
  });

  it('an account with no profile row is "profile missing", not an error', async () => {
    answer({
      profile: { data: null, error: null },
      role: { data: { role: 'customer' }, error: null },
    });
    expect(await fetchAccount(USER)).toMatchObject({
      role: 'customer',
      fullName: null,
      profileMissing: true,
      loadFailed: false,
    });
  });

  it('empty default fields come back as null', async () => {
    answer({
      profile: { data: { full_name: 'Sam', phone: null }, error: null },
      role: { data: null, error: null },
    });
    expect(await fetchAccount(USER)).toMatchObject({
      role: 'customer',
      phone: null,
      defaultAddress: null,
      defaultCity: null,
      defaultState: null,
    });
  });

  it('fails closed to a plain customer, marked as failed, when a read fails', async () => {
    answer({
      profile: { data: null, error: { message: 'boom' } },
      role: { data: { role: 'admin' }, error: null },
    });
    expect(await fetchAccount(USER)).toEqual({
      userId: USER,
      role: 'customer',
      fullName: null,
      phone: null,
      defaultAddress: null,
      defaultCity: null,
      defaultState: null,
      profileMissing: false,
      loadFailed: true,
    });
  });
});
