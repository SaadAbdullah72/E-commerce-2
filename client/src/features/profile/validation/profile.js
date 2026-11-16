import { z } from 'zod';

import { citiesForState, STATES } from '@/shared/constants/locations';

/** The same limits the database enforces (0001 and 0010), so a bad value is caught before sending. */
export const NAME_MAX = 100;
export const PHONE_MAX = 32;
export const ADDRESS_MAX = 300;

const NAME_MIN = 2;
const PHONE_MIN_DIGITS = 7;
const PHONE_PATTERN = /^[0-9+\-().\s]*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const profileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(NAME_MIN, `Enter your full name (at least ${NAME_MIN} characters).`)
      .max(NAME_MAX, `Use ${NAME_MAX} characters or fewer.`)
      .refine((value) => !CONTROL_CHARS.test(value), 'Your name contains invalid characters.'),
    phone: z
      .string()
      .trim()
      .max(PHONE_MAX, `Use ${PHONE_MAX} characters or fewer.`)
      .refine((value) => PHONE_PATTERN.test(value), 'Use only digits, spaces and + - ( ) .')
      .refine(
        (value) => value === '' || value.replace(/\D/g, '').length >= PHONE_MIN_DIGITS,
        `Enter at least ${PHONE_MIN_DIGITS} digits.`,
      ),
    address: z
      .string()
      .trim()
      .max(ADDRESS_MAX, `Use ${ADDRESS_MAX} characters or fewer.`)
      .refine((value) => !CONTROL_CHARS.test(value), 'The address contains invalid characters.'),
    state: z
      .string()
      .refine((value) => value === '' || STATES.includes(value), 'Choose a state from the list.'),
    city: z.string(),
  })
  .superRefine((values, context) => {
    if (values.city !== '' && !citiesForState(values.state).includes(values.city)) {
      context.addIssue({ code: 'custom', path: ['city'], message: 'Choose a city from the list.' });
    }
  });

/**
 * Form values from the loaded account. Empty text, never null, so inputs stay controlled.
 * @param {{ fullName?: string | null, phone?: string | null, defaultAddress?: string | null,
 *   defaultState?: string | null, defaultCity?: string | null } | null | undefined} account
 */
export function initialProfileValues(account) {
  return {
    fullName: account?.fullName ?? '',
    phone: account?.phone ?? '',
    address: account?.defaultAddress ?? '',
    state: account?.defaultState ?? '',
    city: account?.defaultCity ?? '',
  };
}

/**
 * The row sent to the database: only the five editable columns, and empty means NULL (the name is
 * required, so it is never empty). A city without a state is dropped.
 *
 * @param {{ fullName: string, phone: string, address: string, state: string, city: string }} values
 */
export function toProfileRow(values) {
  const state = values.state.trim();
  return {
    full_name: values.fullName.trim(),
    phone: values.phone.trim() || null,
    default_address: values.address.trim() || null,
    default_state: state || null,
    default_city: state ? values.city.trim() || null : null,
  };
}
