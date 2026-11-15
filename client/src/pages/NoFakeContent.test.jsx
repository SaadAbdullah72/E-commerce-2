import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../features/auth/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('../context/CartContext', () => ({
  useCart: () => ({ subtotalMinor: 2500, totalItems: 1, setIsCartOpen: vi.fn() }),
}));

import ProductReviewsSection from '../components/product/ProductReviewsSection';
import MyOrdersPage from './MyOrdersPage';
import ProfilePage from './ProfilePage';
import ShippingPage from './ShippingPage';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage(ui, path = '/page') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/page" element={ui} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.value = {
    status: 'authenticated',
    user: { email: 'sam@example.com' },
    account: { fullName: 'Sam Lee', phone: null },
    isAdmin: false,
  };
});

const FAKE = [
  /Huzaifa/i,
  /huzaifa@/i,
  /F Block/i,
  /\[cite/i,
  /Verified Buyer/i,
  /TRK-/i,
  /Leopard/i,
];

describe('My Orders', () => {
  it('says there are no orders, and shows no invented ones', () => {
    const { container } = renderPage(<MyOrdersPage />);

    expect(screen.getByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
    expect(screen.getByText('When you place an order, it will appear here.')).toBeInTheDocument();
    for (const pattern of FAKE) expect(container).not.toHaveTextContent(pattern);
    expect(container.querySelector('img')).toBeNull();
    expect(container).not.toHaveTextContent(/SY-\d+/);
  });

  it('sends the customer back to shopping', async () => {
    renderPage(<MyOrdersPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Start shopping' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });
});

describe('Shipping page', () => {
  const field = (name) => document.querySelector(`[name="${name}"]`);

  it('fills in the name and email from the signed-in account, and leaves phone and address empty', () => {
    renderPage(<ShippingPage />);
    expect(field('fullName')).toHaveValue('Sam Lee');
    expect(field('email')).toHaveValue('sam@example.com');
    expect(field('phone')).toHaveValue('');
    expect(field('address')).toHaveValue('');
  });

  it('starts empty when the account has no name yet, never with someone else details', () => {
    auth.value = { status: 'authenticated', user: null, account: null, isAdmin: false };
    const { container } = renderPage(<ShippingPage />);
    expect(field('fullName')).toHaveValue('');
    expect(field('email')).toHaveValue('');
    for (const pattern of FAKE) expect(container).not.toHaveTextContent(pattern);
  });

  it('has no stray citation text, even in the free-delivery notice', async () => {
    const { container } = renderPage(<ShippingPage />);
    await userEvent.selectOptions(field('state'), 'Bauchi State (Primary Local Hub)');
    expect(container).toHaveTextContent(/100% FREE Delivery/);
    expect(container.innerHTML).not.toMatch(/\[cite/);
  });
});

describe('Profile page', () => {
  it('no longer shows a made-up "2 Active" orders badge, but keeps the real details', () => {
    renderPage(<ProfilePage onLogout={() => {}} />);
    expect(screen.queryByText(/2 Active/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My Orders/i })).toHaveAttribute('href', '/orders');
    expect(screen.getByText('Verified Account')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
  });
});

describe('Product reviews', () => {
  it('says "No reviews yet." with no form, no invitation and no fake labels', () => {
    const { container } = render(<ProductReviewsSection />);

    expect(screen.getByRole('heading', { name: 'Customer Reviews (0)' })).toBeInTheDocument();
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/be the first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in to write/i)).not.toBeInTheDocument();
    for (const pattern of FAKE) expect(container).not.toHaveTextContent(pattern);
  });

  it('shows real reviews if some are passed in, with no "verified" label of its own', () => {
    const { container } = render(
      <ProductReviewsSection
        reviews={[
          { id: 'r1', userName: 'Ada', rating: 4, date: 'Jan 1', comment: 'Works well.' },
          { id: 'r2', userName: 'Bo', rating: 5, date: 'Jan 2', comment: 'Great.' },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Customer Reviews (2)' })).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Works well.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByText('No reviews yet.')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/verified/i);
  });

  it('shows review text as plain text, never as markup', () => {
    const { container } = render(
      <ProductReviewsSection
        reviews={[
          {
            id: 'r1',
            userName: '<b>x</b>',
            rating: 3,
            date: 'Jan 1',
            comment: '<img src=x onerror=alert(1)>',
          },
        ]}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
