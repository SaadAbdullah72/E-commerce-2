import { supabase } from '@/lib/supabase/client';

import { toProfileRow } from '../validation/profile';

const MESSAGES = {
  invalid: 'Some details were not accepted. Please check them and try again.',
  forbidden: 'You are not allowed to change this profile. Please sign in again.',
  not_found: 'Profile not found. Contact support.',
  unknown: "We couldn't save your profile. Please try again.",
};

/** A failed save. The message is already plain wording for the customer. */
export class ProfileError extends Error {
  /** @param {'invalid' | 'forbidden' | 'not_found' | 'unknown'} code */
  constructor(code) {
    super(MESSAGES[code] ?? MESSAGES.unknown);
    this.name = 'ProfileError';
    this.code = code;
  }
}

/**
 * Save the signed-in customer's own profile: name, phone and default address. The database allows
 * only these five columns, only on the customer's own row, and re-checks every length.
 *
 * "Nothing was updated" is a failure, not a success: it means the account has no profile row.
 *
 * @param {string} userId
 * @param {{ fullName: string, phone: string, address: string, state: string, city: string }} values
 * @throws {ProfileError}
 */
export async function updateProfile(userId, values) {
  const { data, error } = await supabase
    .from('profiles')
    .update(toProfileRow(values))
    .eq('id', userId)
    .select('id');

  if (error) {
    if (error.code === '23514') throw new ProfileError('invalid');
    if (error.code === '42501') throw new ProfileError('forbidden');
    throw new ProfileError('unknown');
  }
  if (!data || data.length === 0) throw new ProfileError('not_found');
}
