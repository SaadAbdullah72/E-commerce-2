import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';

import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="cursor-pointer rounded-md p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-base font-black text-gray-900">ShopYaro Admin</h1>
        </div>
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden max-w-60 truncate text-xs text-gray-500 sm:inline">
              {user.email}
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            <LogOut size={14} aria-hidden="true" /> Log out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside
          className={`${
            menuOpen ? 'block' : 'hidden'
          } fixed inset-x-0 top-14 z-20 border-b border-gray-200 bg-white p-3 shadow-md lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0 lg:shadow-none`}
        >
          <AdminSidebar onNavigate={() => setMenuOpen(false)} />
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
