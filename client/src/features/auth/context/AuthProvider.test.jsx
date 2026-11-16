import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  fetchAccount: vi.fn(),
  signOutLocal: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange },
  },
}));
vi.mock('../services/sessionService', () => ({
  fetchAccount: mocks.fetchAccount,
  signOutLocal: mocks.signOutLocal,
}));

import { useAuth } from '../hooks/useAuth';
import AuthProvider from './AuthProvider';

let emit;

function Probe() {
  const [result, setResult] = useState('');
  const { status, role, isAdmin, user, account, signOut, refreshAccount } = useAuth();
  return (
    <div>
      <p data-testid="state">{`${status}|${role}|${isAdmin}|${user?.id ?? 'none'}`}</p>
      <p data-testid="name">{account?.fullName ?? 'none'}</p>
      <button onClick={signOut}>out</button>
      <button onClick={async () => setResult(String(await refreshAccount()))}>refresh</button>
      <p data-testid="result">{result}</p>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const state = () => screen.getByTestId('state').textContent;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.onAuthStateChange.mockImplementation((callback) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
  mocks.signOutLocal.mockResolvedValue(undefined);
});

describe('AuthProvider', () => {
  it('is "loading" until the stored session is checked, then anonymous', async () => {
    let resolve;
    mocks.getSession.mockReturnValue(new Promise((r) => (resolve = r)));
    renderProvider();
    expect(state()).toBe('loading|null|false|none');

    await act(async () => resolve({ data: { session: null } }));
    expect(state()).toBe('anonymous|null|false|none');
  });

  it('stays "loading" until the role is loaded, then reports it from the database', async () => {
    let resolveAccount;
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mocks.fetchAccount.mockReturnValue(new Promise((r) => (resolveAccount = r)));
    renderProvider();

    await waitFor(() => expect(mocks.fetchAccount).toHaveBeenCalledWith('u1'));
    expect(state()).toBe('loading|null|false|u1');

    await act(async () => resolveAccount({ userId: 'u1', role: 'admin', fullName: 'A' }));
    expect(state()).toBe('authenticated|admin|true|u1');
  });

  it('reports a customer for a customer account', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mocks.fetchAccount.mockResolvedValue({ userId: 'u1', role: 'customer', fullName: 'C' });
    renderProvider();

    await waitFor(() => expect(state()).toBe('authenticated|customer|false|u1'));
  });

  it('follows sign-in and sign-out events', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.fetchAccount.mockResolvedValue({ userId: 'u2', role: 'customer', fullName: 'C' });
    renderProvider();
    await waitFor(() => expect(state()).toContain('anonymous'));

    await act(async () => emit('SIGNED_IN', { user: { id: 'u2' } }));
    await waitFor(() => expect(state()).toBe('authenticated|customer|false|u2'));

    await act(async () => emit('SIGNED_OUT', null));
    expect(state()).toBe('anonymous|null|false|none');
  });

  it('never treats a password-recovery session as a login', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.fetchAccount.mockResolvedValue({ userId: 'u3', role: 'admin', fullName: 'A' });
    renderProvider();
    await waitFor(() => expect(state()).toContain('anonymous'));

    await act(async () => {
      emit('PASSWORD_RECOVERY', { user: { id: 'u3' } });
    });

    expect(state()).toBe('anonymous|null|false|none');
    expect(mocks.fetchAccount).not.toHaveBeenCalled();
  });

  it('signOut clears the session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mocks.fetchAccount.mockResolvedValue({ userId: 'u1', role: 'customer', fullName: 'C' });
    renderProvider();
    await waitFor(() => expect(state()).toContain('authenticated'));

    await act(async () => screen.getByText('out').click());

    expect(mocks.signOutLocal).toHaveBeenCalled();
    expect(state()).toBe('anonymous|null|false|none');
  });

  describe('refreshAccount', () => {
    const signedIn = () =>
      mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const name = () => screen.getByTestId('name').textContent;

    it('re-reads the profile so every page shows the new name', async () => {
      signedIn();
      mocks.fetchAccount.mockResolvedValueOnce({ userId: 'u1', role: 'customer', fullName: 'Old' });
      renderProvider();
      await waitFor(() => expect(name()).toBe('Old'));

      mocks.fetchAccount.mockResolvedValueOnce({ userId: 'u1', role: 'customer', fullName: 'New' });
      await act(async () => screen.getByText('refresh').click());

      expect(name()).toBe('New');
      expect(screen.getByTestId('result')).toHaveTextContent('true');
      expect(state()).toBe('authenticated|customer|false|u1'); // never flickers back to loading
    });

    it('keeps what is shown when the re-read fails', async () => {
      signedIn();
      mocks.fetchAccount.mockResolvedValueOnce({ userId: 'u1', role: 'customer', fullName: 'Old' });
      renderProvider();
      await waitFor(() => expect(name()).toBe('Old'));

      mocks.fetchAccount.mockResolvedValueOnce({
        userId: 'u1',
        role: 'customer',
        fullName: null,
        loadFailed: true,
      });
      await act(async () => screen.getByText('refresh').click());

      expect(name()).toBe('Old');
      expect(screen.getByTestId('result')).toHaveTextContent('false');
    });

    it('ignores an answer that arrives after sign-out', async () => {
      signedIn();
      mocks.fetchAccount.mockResolvedValueOnce({ userId: 'u1', role: 'customer', fullName: 'Old' });
      renderProvider();
      await waitFor(() => expect(name()).toBe('Old'));

      let late;
      mocks.fetchAccount.mockReturnValueOnce(new Promise((resolve) => (late = resolve)));
      await act(async () => screen.getByText('refresh').click());
      await act(async () => screen.getByText('out').click());
      await act(async () => late({ userId: 'u1', role: 'customer', fullName: 'Late' }));

      expect(state()).toBe('anonymous|null|false|none');
      expect(name()).toBe('none');
      expect(screen.getByTestId('result')).toHaveTextContent('false');
    });

    it('does nothing when nobody is signed in', async () => {
      mocks.getSession.mockResolvedValue({ data: { session: null } });
      renderProvider();
      await waitFor(() => expect(state()).toContain('anonymous'));

      await act(async () => screen.getByText('refresh').click());

      expect(mocks.fetchAccount).not.toHaveBeenCalled();
      expect(screen.getByTestId('result')).toHaveTextContent('false');
    });
  });

  it('unsubscribes on unmount', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const { unmount } = renderProvider();
    await waitFor(() => expect(state()).toContain('anonymous'));
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it('useAuth throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
