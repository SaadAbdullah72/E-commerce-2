import { NavLink } from 'react-router-dom';

import { ADMIN_SECTIONS } from '../lib/adminStats';
import StatusBadge from './StatusBadge';

const linkClass = ({ isActive }) =>
  `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
  }`;

/** @param {{ onNavigate?: () => void }} props */
export default function AdminSidebar({ onNavigate }) {
  return (
    <nav aria-label="Admin" className="space-y-1">
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
