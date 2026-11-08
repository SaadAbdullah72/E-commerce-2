import { useCallback, useState } from 'react';

/**
 * One show/hide state for every password field in a form, so toggling the eye
 * on either the password or the confirm field switches both together.
 * Defaults to hidden.
 *
 * @returns {{ visible: boolean, toggle: () => void }}
 */
export function usePasswordVisibility() {
  const [visible, setVisible] = useState(false);
  const toggle = useCallback(() => setVisible((current) => !current), []);
  return { visible, toggle };
}
