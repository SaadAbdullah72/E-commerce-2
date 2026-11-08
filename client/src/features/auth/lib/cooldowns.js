/**
 * Cooldown settings shared by every screen that can send an email. UX only: the real
 * limits are enforced by Supabase on the server.
 */

/** Resending the signup confirmation email. */
export const RESEND_SIGNUP_COOLDOWN = {
  key: 'shopyaro:cooldown:resend-signup',
  seconds: 60,
};

/** Requesting (or re-requesting) a password-reset email. */
export const PASSWORD_RESET_COOLDOWN = {
  key: 'shopyaro:cooldown:password-reset',
  seconds: 60,
};
