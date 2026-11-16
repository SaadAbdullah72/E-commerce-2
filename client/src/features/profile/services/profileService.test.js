import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { ProfileError, updateProfile } from './profileService';

const USER = '11111111-1111-4111-8111-111111111111';
const values = {
  fullName: ' Sam Lee ',
  phone: '',
  address: '1 Test Street',
  state: 'Lagos State',
  city: 'Capital District',
};

/** Records the update and answers like PostgREST. */
function respond(result) {
  const calls = {};
  const select = vi.fn(() => Promise.resolve(result));
  const eq = vi.fn((column, value) => {
    calls.eq = [column, value];
    return { select };
  });
  const update = vi.fn((row) => {
    calls.update = row;
    return { eq };
  });
  supabase.from.mockReturnValue({ update });
  return { calls, select };
}

beforeEach(() => supabase.from.mockReset());

describe('updateProfile', () => {
  it("updates only the five columns, on the customer's own row", async () => {
    const { calls, select } = respond({ data: [{ id: USER }], error: null });
    await updateProfile(USER, values);

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(calls.eq).toEqual(['id', USER]);
    expect(calls.update).toEqual({
      full_name: 'Sam Lee',
      phone: null,
      default_address: '1 Test Street',
      default_state: 'Lagos State',
      default_city: 'Capital District',
    });
    expect(select).toHaveBeenCalledWith('id'); // so "nothing updated" can be noticed
  });

  it('treats "0 rows updated" as a failure: the account has no profile row', async () => {
    respond({ data: [], error: null });
    const promise = updateProfile(USER, values);
    await expect(promise).rejects.toBeInstanceOf(ProfileError);
    await expect(promise).rejects.toMatchObject({
      code: 'not_found',
      message: 'Profile not found. Contact support.',
    });
  });

  it('treats a missing result the same way', async () => {
    respond({ data: null, error: null });
    await expect(updateProfile(USER, values)).rejects.toMatchObject({ code: 'not_found' });
  });

  it.each([
    ['23514', 'invalid', /not accepted/],
    ['42501', 'forbidden', /not allowed/],
    ['XX000', 'unknown', /couldn't save/],
  ])('maps database error %s to %s with plain wording', async (dbCode, code, message) => {
    respond({ data: null, error: { code: dbCode, message: 'secret db detail' } });
    const promise = updateProfile(USER, values);
    await expect(promise).rejects.toMatchObject({ code });
    await expect(promise).rejects.toThrow(message);
    await expect(promise).rejects.not.toThrow('secret db detail');
  });
});
