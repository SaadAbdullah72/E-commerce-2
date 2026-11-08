import { Navigate, useLocation } from 'react-router-dom';

import { ADMIN_SECTIONS } from '../lib/adminStats';

/** Honest placeholder for sections that are built in a later phase. No fake data. */
export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const section = ADMIN_SECTIONS.find((item) => item.path === slug && !item.ready);
  if (!section) return <Navigate to="/admin" replace />;

  return (
    <section>
      <h2 className="text-lg font-black text-gray-900">{section.label}</h2>
      <p className="mt-2 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        Coming in {section.phase}. Nothing is shown here until it is connected to the database.
      </p>
    </section>
  );
}
