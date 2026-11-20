import { Link } from 'react-router-dom';

import Tooltip from '@/shared/ui/Tooltip';

import { iconActionClass } from '../lib/iconActionStyles';

/**
 * An icon-only row action (Edit, Pause, Restore ...) with a tooltip. `label` is the accessible
 * name (for example "Edit Desk lamp"); `tip` is the short word shown on hover and focus.
 * Pass `to` for a link, `onClick` for a button.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.tip
 * @param {import('react').ComponentType<{ size?: number, 'aria-hidden'?: boolean }>} props.icon
 * @param {'neutral' | 'blue' | 'red' | 'green'} [props.tone]
 * @param {string} [props.to]
 * @param {() => void} [props.onClick]
 */
export default function IconAction({ label, tip, icon: Icon, tone = 'neutral', to, onClick }) {
  const content = <Icon size={16} aria-hidden="true" />;
  return (
    <Tooltip content={tip}>
      {to ? (
        <Link to={to} aria-label={label} className={iconActionClass(tone)}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} className={iconActionClass(tone)}>
          {content}
        </button>
      )}
    </Tooltip>
  );
}
