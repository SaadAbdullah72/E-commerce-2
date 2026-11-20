import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { iconActionClass } from '../lib/iconActionStyles';

const RESET_MS = 2000;

/**
 * Copies a coupon code to the clipboard. It only reads the code; nothing is saved. The result is
 * shown in words (Copied / Copy failed) and announced politely to screen readers.
 *
 * @param {{ code: string }} props
 */
export default function CopyCodeButton({ code }) {
  const [state, setState] = useState('idle'); // idle | copied | failed
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let next = 'failed';
    try {
      await navigator.clipboard.writeText(code);
      next = 'copied';
    } catch {
      // no clipboard access (an insecure page, or the user said no)
    }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), RESET_MS);
  };

  const Icon = state === 'copied' ? Check : state === 'failed' ? TriangleAlert : Copy;
  const tone = state === 'copied' ? 'green' : state === 'failed' ? 'red' : 'neutral';
  const message = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : '';

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={copy} aria-label={`Copy ${code}`} className={iconActionClass(tone)}>
        <Icon size={16} aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        className={`text-xs font-semibold ${state === 'failed' ? 'text-red-700' : 'text-green-700'} ${message ? '' : 'sr-only'}`}
      >
        {message}
      </span>
    </span>
  );
}
