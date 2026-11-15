import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../../features/auth/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ totalItems: 3, setIsCartOpen: vi.fn() }),
}));
vi.mock('../../features/banners/components/AnnouncementTicker', () => ({ default: () => null }));

import Navbar from './Navbar';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Navbar />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.value = { status: 'anonymous', isAdmin: false, account: null };
});

describe('Navbar admin link', () => {
  it('is hidden from signed-out visitors', () => {
    renderNavbar();
    expect(screen.queryByRole('button', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('is hidden from customers', () => {
    auth.value = { status: 'authenticated', isAdmin: false, account: { fullName: 'Sam Lee' } };
    renderNavbar();
    expect(screen.queryByRole('button', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('shows for an admin, next to the normal profile and cart buttons, and opens /admin', async () => {
    auth.value = { status: 'authenticated', isAdmin: true, account: { fullName: 'Ada Admin' } };
    renderNavbar();

    expect(screen.getByRole('button', { name: /cart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ada/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /admin panel/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin');
  });
});

describe('Navbar search box', () => {
  it('makes no made-up claim about how many deals there are', () => {
    renderNavbar();
    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('placeholder', 'Search products on ShopYaro...');
    expect(box.getAttribute('placeholder')).not.toMatch(/\d{2},\d{3}|factory/i);
  });
});
