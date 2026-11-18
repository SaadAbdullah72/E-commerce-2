import { Store } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { useOrderStats } from '../hooks/useAdminOrders';
import { ADMIN_SECTIONS } from '../lib/adminStats';
import StatusBadge from './StatusBadge';

const linkClass = ({ isActive }) =>
  `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
  }`;

/** @param {{ onNavigate?: () => void }} props */
export default function AdminSidebar({ onNavigate }) {
  // Orders waiting to be shipped. If the numbers cannot load, no badge is shown (never a made-up 0).
  const toShip = useOrderStats((stats) => stats.toShip).data ?? 0;

  return (
    <nav aria-label="Admin" className="space-y-1">
      <Link
        to="/"
        onClick={onNavigate}
        className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
      >
        <Store size={16} aria-hidden="true" /> Back to Store
      </Link>
      {ADMIN_SECTIONS.map((section) =>
        section.ready ? (
          <NavLink
            key={section.path}
            to={section.path ? `/admin/${section.path}` : '/admin'}
            end={section.path === ''}
            onClick={onNavigate}
            className={linkClass}
          >
            {section.label}
            {section.path === 'orders' && toShip > 0 && (
              <span
                aria-label={`${toShip} to ship`}
                title={`${toShip} to ship`}
                className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white"
              >
                {toShip}
              </span>
            )}
          </NavLink>
        ) : (
          <span
            key={section.path}
            aria-disabled="true"
            className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-gray-400"
          >
            {section.label}
            <StatusBadge>{section.phase}</StatusBadge>
          </span>
        ),
      )}
    </nav>
  );
}
