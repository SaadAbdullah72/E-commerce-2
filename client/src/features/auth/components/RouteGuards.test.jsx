import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth.value }));

import AdminRoute from './AdminRoute';
import ProtectedRoute from './ProtectedRoute';

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function renderAt(path, Guard) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/secret"
          element={
            <Guard>
              <p>secret content</p>
            </Guard>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.value = { status: 'anonymous', isAdmin: false };
});

describe('ProtectedRoute', () => {
  it('shows a spinner (not the page, not a redirect) while loading', () => {
    auth.value = { status: 'loading', isAdmin: false };
    renderAt('/secret', ProtectedRoute);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('sends anonymous users to login, remembering where they wanted to go', () => {
    renderAt('/secret', ProtectedRoute);
    expect(screen.getByTestId('where')).toHaveTextContent('/login?redirect=%2Fsecret');
  });

  it('shows the page to signed-in users', () => {
    auth.value = { status: 'authenticated', isAdmin: false };
    renderAt('/secret', ProtectedRoute);
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('waits while loading', () => {
    auth.value = { status: 'loading', isAdmin: false };
    renderAt('/secret', AdminRoute);
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('sends anonymous users to login', () => {
    renderAt('/secret', AdminRoute);
    expect(screen.getByTestId('where')).toHaveTextContent('/login');
  });

  it('sends customers home', () => {
    auth.value = { status: 'authenticated', isAdmin: false };
    renderAt('/secret', AdminRoute);
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('shows the page to admins', () => {
    auth.value = { status: 'authenticated', isAdmin: true };
    renderAt('/secret', AdminRoute);
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
