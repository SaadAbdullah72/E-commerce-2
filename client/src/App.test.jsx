import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('./features/auth/hooks/useAuth', () => ({ useAuth: () => auth.value }));

// Heavy parts are replaced with markers; this test is about routing and the guards.
vi.mock('./components/layout/Navbar', () => ({ default: () => <nav>storefront navbar</nav> }));
vi.mock('./components/cart/CartDrawer', () => ({ default: () => <aside>cart drawer</aside> }));
vi.mock('./pages/HomePage', () => ({ default: () => <p>home page</p> }));
vi.mock('./features/admin/routes', () => ({ default: () => <p>admin area</p> }));
vi.mock('./pages/CategoryPage', () => ({ default: () => null }));
vi.mock('./pages/ProductDetailPage', () => ({ default: () => null }));
vi.mock('./pages/ShippingPage', () => ({ default: () => null }));
vi.mock('./pages/CheckoutPage', () => ({ default: () => null }));

import App from './App';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );
}

const admin = { status: 'authenticated', isAdmin: true, signOut: vi.fn() };
const customer = { status: 'authenticated', isAdmin: false, signOut: vi.fn() };
const anonymous = { status: 'anonymous', isAdmin: false, signOut: vi.fn() };

beforeEach(() => {
  auth.value = anonymous;
});

describe('admins and the storefront', () => {
  it('lets an admin browse the shop: no redirect, navbar and cart visible', () => {
    auth.value = admin;
    renderAt('/');
    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(screen.getByText('storefront navbar')).toBeInTheDocument();
    expect(screen.getByText('cart drawer')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });

  it('lets an admin open /admin, without the storefront navbar or cart', async () => {
    auth.value = admin;
    renderAt('/admin');
    expect(await screen.findByText('admin area')).toBeInTheDocument();
    expect(screen.queryByText('storefront navbar')).not.toBeInTheDocument();
    expect(screen.queryByText('cart drawer')).not.toBeInTheDocument();
  });
});

describe('admin area protection', () => {
  it('sends a customer away from /admin', () => {
    auth.value = customer;
    renderAt('/admin/coupons');
    expect(screen.queryByText('admin area')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
    expect(screen.getByText('home page')).toBeInTheDocument();
  });

  it('does not show /admin to an anonymous visitor', () => {
    auth.value = anonymous;
    renderAt('/admin');
    expect(screen.queryByText('admin area')).not.toBeInTheDocument();
  });

  it('shows customers the normal shop chrome', () => {
    auth.value = customer;
    renderAt('/');
    expect(screen.getByText('storefront navbar')).toBeInTheDocument();
    expect(screen.getByText('cart drawer')).toBeInTheDocument();
  });
});
