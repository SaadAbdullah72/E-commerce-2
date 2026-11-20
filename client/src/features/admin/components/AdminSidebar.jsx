import { Store } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { useOrderStats } from '../hooks/useAdminOrders';
import { usePendingReviewCount } from '../hooks/useAdminReviews';
import { ADMIN_SECTIONS } from '../lib/adminStats';
import { NAV_GROUPS, NAV_ICONS } from './adminNav';
import StatusBadge from './StatusBadge';

// Wide screens show icon + label; tablets show an icon-only rail (the label stays for screen readers).
const ROW =
  'relative flex items-center gap-3 border-l-4 px-3 py-2.5 text-sm font-medium transition-colors duration-150 max-md:min-h-11 md:justify-center lg:justify-start';

const linkClass = ({ isActive }) =>
  `${ROW} rounded-r-lg ${
    isActive
      ? 'border-blue-600 bg-blue-50 text-blue-700'
      : 'border-transparent text-gray-700 hover:bg-gray-100'
  }`;

const LABEL = 'md:sr-only lg:not-sr-only';
const BADGE_POSITION = 'md:absolute md:right-1 md:top-1 lg:static lg:ml-auto';

/** @param {{ onNavigate?: () => void }} props */
export default function AdminSidebar({ onNavigate }) {
  // Orders waiting to be shipped. If the numbers cannot load, no badge is shown (never a made-up 0).
  const toShip = useOrderStats((stats) => stats.toShip).data ?? 0;
  // Reviews waiting for approval. Same rule: no badge when the count cannot load.
  const pendingReviews = usePendingReviewCount().data ?? 0;

  const sectionByPath = new Map(ADMIN_SECTIONS.map((section) => [section.path, section]));

  return (
    <nav aria-label="Admin" className="space-y-5">
      <Link
        to="/"
        onClick={onNavigate}
        title="Back to Store"
        className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 max-md:min-h-11 md:justify-center lg:justify-start"
      >
        <Store size={20} aria-hidden="true" />
        <span className={LABEL}>Back to Store</span>
      </Link>

      {NAV_GROUPS.map((group) => {
        const sections = group.paths.map((path) => sectionByPath.get(path)).filter(Boolean);
        if (sections.length === 0) return null;
        return (
          <div key={group.label} role="group" aria-label={group.label}>
            <p
              aria-hidden="true"
              className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden lg:block"
            >
              {group.label}
            </p>
            <div className="space-y-0.5">
              {sections.map((section) => {
                const Icon = NAV_ICONS[section.path];
                const icon = Icon && <Icon size={20} className="shrink-0" aria-hidden="true" />;
                if (!section.ready) {
                  return (
                    <span
                      key={section.path}
                      aria-disabled="true"
                      className={`${ROW} cursor-not-allowed rounded-r-lg border-transparent text-gray-500`}
                    >
                      {icon}
                      <span className={LABEL}>{section.label}</span>
                      <span className={BADGE_POSITION}>
                        <StatusBadge>{section.phase}</StatusBadge>
                      </span>
                    </span>
                  );
                }
                return (
                  <NavLink
                    key={section.path}
                    to={section.path ? `/admin/${section.path}` : '/admin'}
                    end={section.path === ''}
                    onClick={onNavigate}
                    title={section.label}
                    className={linkClass}
                  >
                    {icon}
                    <span className={LABEL}>{section.label}</span>
                    {section.path === 'orders' && toShip > 0 && (
                      <span
                        aria-label={`${toShip} to ship`}
                        title={`${toShip} to ship`}
                        className={`${BADGE_POSITION} rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold tabular-nums text-white`}
                      >
                        {toShip}
                      </span>
                    )}
                    {section.path === 'reviews' && pendingReviews > 0 && (
                      <span
                        aria-label={`${pendingReviews} pending`}
                        title={`${pendingReviews} pending`}
                        className={`${BADGE_POSITION} rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800`}
                      >
                        {pendingReviews}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
