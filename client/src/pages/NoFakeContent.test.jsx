import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../features/auth/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('../context/CartContext', () => ({
  useCart: () => ({ subtotalMinor: 2500, totalItems: 1, setIsCartOpen: vi.fn() }),
}));

import { saveShipping } from '../features/checkout/lib/shippingStorage';
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
  sessionStorage.clear();
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

  it('fills in the phone and default address saved on the profile', () => {
    auth.value = {
      ...auth.value,
      account: {
        fullName: 'Sam Lee',
        phone: '+10000000000',
        defaultAddress: '1 Test Street',
        defaultState: 'Lagos State',
        defaultCity: 'Capital District',
      },
    };
    renderPage(<ShippingPage />);
    expect(field('phone')).toHaveValue('+10000000000');
    expect(field('address')).toHaveValue('1 Test Street');
    expect(field('state')).toHaveValue('Lagos State');
    expect(field('city')).toHaveValue('Capital District');
    expect(field('courier')).toHaveValue(''); // the customer still picks a courier
  });

  it('picks the local courier for a saved Bauchi address', () => {
    auth.value = {
      ...auth.value,
      account: { fullName: 'Sam Lee', defaultState: 'Bauchi State (Primary Local Hub)', defaultCity: 'Azare' },
    };
    renderPage(<ShippingPage />);
    expect(field('city')).toHaveValue('Azare');
    expect(field('courier').value).toMatch(/ShopYaro Express/);
  });

  it('leaves out a saved state or city that is not one of the choices', () => {
    auth.value = {
      ...auth.value,
      account: { fullName: 'Sam Lee', defaultAddress: '1 Test Street', defaultState: 'Narnia', defaultCity: 'X' },
    };
    renderPage(<ShippingPage />);
    expect(field('address')).toHaveValue('1 Test Street');
    expect(field('state')).toHaveValue('');
    expect(field('city')).toHaveValue('');
  });

  it('what was already typed in this tab wins over the saved default', () => {
    auth.value = {
      ...auth.value,
      user: { id: 'u1', email: 'sam@example.com' },
      account: { fullName: 'Sam Lee', defaultAddress: 'Saved Street' },
    };
    saveShipping(
      {
        fullName: 'Sam Lee',
        email: 'sam@example.com',
        phone: '+10000000000',
        address: 'Typed Street',
        state: 'Lagos State',
        city: 'Capital District',
        courier: 'Shipbubble',
      },
      'u1',
    );
    renderPage(<ShippingPage />);
    expect(field('address')).toHaveValue('Typed Street');
    sessionStorage.clear();
  });

  it('has no stray citation text, even in the free-delivery notice', async () => {
    const { container } = renderPage(<ShippingPage />);
    await userEvent.selectOptions(field('state'), 'Bauchi State (Primary Local Hub)');
    expect(container).toHaveTextContent(/100% FREE Delivery/);
    expect(container.innerHTML).not.toMatch(/\[cite/);
  });
});
