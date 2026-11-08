import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { status: 'loading', isAdmin: false },
  completeOAuthCallback: vi.fn(),
  consumeOAuthRedirect: vi.fn(),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../services/oauthService', () => ({
  completeOAuthCallback: mocks.completeOAuthCallback,
  consumeOAuthRedirect: mocks.consumeOAuthRedirect,
}));

import AuthCallbackPage from './AuthCallbackPage';

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function visit(search) {
  window.history.pushState({}, '', `/auth/callback${search}`);
}

function renderPage() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.status = 'loading';
  mocks.auth.isAdmin = false;
  mocks.consumeOAuthRedirect.mockReturnValue('/shipping');
});

describe('AuthCallbackPage', () => {
  it('finishes once even under StrictMode, then removes the code from the URL', async () => {
    visit('?code=abc');
    mocks.completeOAuthCallback.mockResolvedValue({ ok: true });
    renderPage();

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(mocks.completeOAuthCallback).toHaveBeenCalledTimes(1);
    expect(mocks.completeOAuthCallback).toHaveBeenCalledWith({ hasCode: true, error: null });
    expect(screen.getByRole('status', { name: 'Signing you in' })).toBeInTheDocument();
  });

  it('waits for the account (role) to load before leaving', async () => {
    visit('?code=abc');
    mocks.completeOAuthCallback.mockResolvedValue({ ok: true });
    const view = renderPage();

    await waitFor(() => expect(mocks.consumeOAuthRedirect).toHaveBeenCalled());
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();

    mocks.auth.status = 'authenticated';
    view.rerender(
      <StrictMode>
        <MemoryRouter initialEntries={['/auth/callback']}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/shipping');
  });

  it('sends admins to /admin whatever the remembered destination', async () => {
    visit('?code=abc');
    mocks.auth.status = 'authenticated';
    mocks.auth.isAdmin = true;
    mocks.completeOAuthCallback.mockResolvedValue({ ok: true });
    renderPage();

    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
  });

  it('shows a calm "cancelled" screen when the user backs out at Google', async () => {
    visit('?error=access_denied&error_description=User+denied');
    mocks.completeOAuthCallback.mockResolvedValue({ ok: false, code: 'cancelled' });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Sign-in cancelled' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
    expect(window.location.search).toBe('');
    expect(document.body.textContent).not.toContain('User denied');
  });

  it('shows a safe error and no navigation when the exchange fails', async () => {
    visit('?code=bad');
    mocks.completeOAuthCallback.mockResolvedValue({ ok: false, code: 'failed' });
    renderPage();

    expect(
      await screen.findByRole('heading', { name: "We couldn't sign you in" }),
    ).toBeInTheDocument();
    expect(mocks.consumeOAuthRedirect).not.toHaveBeenCalled();
  });

  it('does not leave while still unauthenticated even after success', async () => {
    visit('?code=abc');
    mocks.auth.status = 'loading';
    mocks.completeOAuthCallback.mockResolvedValue({ ok: true });
    renderPage();

    await waitFor(() => expect(mocks.consumeOAuthRedirect).toHaveBeenCalled());
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });
});
