import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { CartProvider } from '@/context/CartContext';

/**
 * Render a page the way the app does: React Query cache, router and cart.
 * Retries are off so a failing request shows its error state straight away.
 *
 * @param {import('react').ReactElement} ui
 * @param {{ route?: string, path?: string }} [options]
 */
export function renderWithProviders(ui, { route = '/', path = '*' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </MemoryRouter>
      </CartProvider>
    </QueryClientProvider>,
  );
}
