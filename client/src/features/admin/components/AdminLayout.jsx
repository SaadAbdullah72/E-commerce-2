import { ChevronRight, LogOut, Menu, Store, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ToastProvider } from '@/shared/ui/Toast';

import { ADMIN_SECTIONS } from '../lib/adminStats';
import AdminSidebar from './AdminSidebar';

const ICON_BUTTON = 'max-sm:aspect-square max-sm:min-w-11 max-sm:px-0';

/** "Orders > Detail" from the address. Only the section name and a generic word: no ids or names. */
function breadcrumbFor(pathname) {
  const [section, child] = pathname.replace(/^\/admin\/?/, '').split('/');
  const found = ADMIN_SECTIONS.find((item) => item.path === section);
  if (!section || !found) return [];
  const crumbs = [{ label: found.label, to: `/admin/${found.path}` }];
  if (child) crumbs.push({ label: child === 'new' ? 'New' : 'Detail' });
  return crumbs;
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const crumbs = breadcrumbFor(pathname);

  // Escape closes the phone menu.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]"
        >
          Skip to main content
        </a>

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-gray-700 transition-colors duration-150 hover:bg-gray-100 md:hidden"
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            <h1 className="shrink-0 text-base font-semibold tracking-tight text-gray-900">
              ShopYaro Admin
            </h1>
            {crumbs.length > 0 && (
              <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
                <ol className="flex items-center gap-1 text-sm text-gray-600">
                  {crumbs.map((crumb, index) => (
                    <li key={crumb.label} className="flex items-center gap-1">
                      <ChevronRight size={14} className="text-gray-400" aria-hidden="true" />
                      {crumb.to && index < crumbs.length - 1 ? (
                        <Link to={crumb.to} className="rounded hover:text-gray-900 hover:underline">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span aria-current="page" className="font-medium text-gray-900">
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user?.email && (
              <span className="hidden max-w-60 truncate text-sm text-gray-600 sm:inline">
                {user.email}
              </span>
            )}
            <Link
              to="/"
              aria-label="Back to Store"
              className={buttonClass({ variant: 'secondary', size: 'sm', className: ICON_BUTTON })}
            >
              <Store size={16} aria-hidden="true" />
              <span className="max-sm:sr-only">Back to Store</span>
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              aria-label="Log out"
              className={buttonClass({ variant: 'secondary', size: 'sm', className: ICON_BUTTON })}
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="max-sm:sr-only">Log out</span>
            </button>
          </div>
        </header>

        <div className="flex">
          <aside
            className={`${
              menuOpen ? 'block' : 'hidden'
            } fixed inset-x-0 bottom-0 top-16 z-20 overflow-y-auto bg-white p-3 md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:w-16 md:shrink-0 md:border-r md:border-gray-200 md:p-2 lg:w-[260px] lg:p-3`}
          >
            <AdminSidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <div key={pathname} className="page-fade">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
