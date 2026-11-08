import { useCallback, useEffect, useState } from 'react';

/**
 * A resend/submit cooldown whose end time survives a page refresh.
 *
 * This is a UX aid only. The real limit is Supabase's server-side rate limit;
 * a user who clears sessionStorage can bypass the timer but not the server.
 * Only an end timestamp is stored, never an email address.
 */

function readEndAt(storageKey) {
  try {
    const stored = Number(window.sessionStorage.getItem(storageKey));
    return Number.isFinite(stored) && stored > Date.now() ? stored : 0;
  } catch {
    return 0;
  }
}

function writeEndAt(storageKey, endAt) {
  try {
    window.sessionStorage.setItem(storageKey, String(endAt));
  } catch {
    // Storage unavailable (private mode, blocked): the cooldown just won't persist.
  }
}

/**
 * Begin a cooldown from code that has no mounted hook, e.g. right after an email was sent
 * and the next screen will show the resend button.
 * @param {string} storageKey
 * @param {number} durationSeconds
 */
export function beginCooldown(storageKey, durationSeconds) {
  writeEndAt(storageKey, Date.now() + durationSeconds * 1000);
}

/**
 * @param {string} storageKey Unique per action, e.g. "shopyaro:cooldown:forgot-password"
 * @param {number} durationSeconds
 * @returns {{ remaining: number, isCoolingDown: boolean, start: () => void }}
 */
export function useCooldown(storageKey, durationSeconds) {
  const [endAt, setEndAt] = useState(() => readEndAt(storageKey));
  const [now, setNow] = useState(() => Date.now());

  const remaining = Math.max(0, Math.ceil((endAt - now) / 1000));
  const isCoolingDown = remaining > 0;

  useEffect(() => {
    if (!isCoolingDown) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isCoolingDown]);

  const start = useCallback(() => {
    const end = Date.now() + durationSeconds * 1000;
    writeEndAt(storageKey, end);
    setEndAt(end);
    setNow(Date.now());
  }, [storageKey, durationSeconds]);

  return { remaining, isCoolingDown, start };
}
