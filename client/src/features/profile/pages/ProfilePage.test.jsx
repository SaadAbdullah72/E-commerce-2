import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
const service = vi.hoisted(() => ({ updateProfile: vi.fn() }));
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('../services/profileService', async (importOriginal) => ({
  ...(await importOriginal()),
  updateProfile: service.updateProfile,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import { ProfileError } from '../services/profileService';
import ProfilePage from './ProfilePage';

const USER = '11111111-1111-4111-8111-111111111111';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage(onLogout = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage onLogout={onLogout} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onLogout;
}

beforeEach(() => {
  service.updateProfile.mockReset();
  auth.value = {
    status: 'authenticated',
    user: { id: USER, email: 'sam@example.com' },
    account: {
      userId: USER,
      fullName: 'Sam Lee',
      phone: '+10000000000',
      defaultAddress: '1 Test Street',
      defaultState: 'Lagos State',
      defaultCity: 'Capital District',
      profileMissing: false,
      loadFailed: false,
    },
    refreshAccount: vi.fn().mockResolvedValue(true),
    isAdmin: false,
  };
});

const name = () => screen.getByLabelText('Full Name');
const save = () => screen.getByRole('button', { name: /Save changes|Saving/ });

describe('Profile page', () => {
  it('shows the saved details, with no made-up orders badge and no "coming soon" notice', () => {
    renderPage();
    expect(name()).toHaveValue('Sam Lee');
    expect(screen.getByLabelText('Phone Number')).toHaveValue('+10000000000');
    expect(screen.getByLabelText('Street Address')).toHaveValue('1 Test Street');
    expect(screen.getByLabelText('State')).toHaveValue('Lagos State');
    expect(screen.getByLabelText('City')).toHaveValue('Capital District');
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/2 Active/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Postal Code/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My Orders/i })).toHaveAttribute('href', '/orders');
    expect(screen.getByText('Verified Account')).toBeInTheDocument();
  });

  it('keeps the email read-only', () => {
    renderPage();
    const email = screen.getByLabelText('Email Address');
    expect(email).toHaveValue('sam@example.com');
    expect(email).toBeDisabled();
  });

  it('cannot be saved until something changes', async () => {
    renderPage();
    expect(save()).toBeDisabled();
    await userEvent.type(name(), 'x');
    expect(save()).toBeEnabled();
  });

  it('saves, refreshes the account so the navbar updates, and says so', async () => {
    service.updateProfile.mockResolvedValue(undefined);
    renderPage();

    await userEvent.clear(name());
    await userEvent.type(name(), 'Samuel Lee');
    await userEvent.clear(screen.getByLabelText('Phone Number'));
    await userEvent.click(save());

    expect(await screen.findByRole('status')).toHaveTextContent('Your profile was saved.');
    expect(service.updateProfile).toHaveBeenCalledWith(USER, {
      fullName: 'Samuel Lee',
      phone: '',
      address: '1 Test Street',
      state: 'Lagos State',
      city: 'Capital District',
    });
    expect(auth.value.refreshAccount).toHaveBeenCalledTimes(1);
    expect(save()).toBeDisabled(); // nothing left to save
  });

  it('the success message goes away when the customer edits again', async () => {
    service.updateProfile.mockResolvedValue(undefined);
    renderPage();
    await userEvent.type(name(), 'y');
    await userEvent.click(save());
    await screen.findByRole('status');

    await userEvent.type(name(), 'z');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it("changing the state clears the city and offers that state's cities", async () => {
    renderPage();
    await userEvent.selectOptions(
      screen.getByLabelText('State'),
      'Bauchi State (Primary Local Hub)',
    );

    const city = screen.getByLabelText('City');
    expect(city).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Azare' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Capital District' })).not.toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('the address can be cleared and saved as empty', async () => {
    service.updateProfile.mockResolvedValue(undefined);
    renderPage();
    await userEvent.clear(screen.getByLabelText('Street Address'));
    await userEvent.selectOptions(screen.getByLabelText('State'), '');
    await userEvent.click(save());

    await waitFor(() => expect(service.updateProfile).toHaveBeenCalled());
    expect(service.updateProfile.mock.calls[0][1]).toMatchObject({
      address: '',
      state: '',
      city: '',
    });
  });

  describe('validation', () => {
    it('refuses an empty name, shows why next to the field, and sends nothing', async () => {
      renderPage();
      await userEvent.clear(name());
      await userEvent.click(save());

      expect(await screen.findByText(/Enter your full name/)).toBeInTheDocument();
      expect(name()).toHaveAttribute('aria-invalid', 'true');
      expect(service.updateProfile).not.toHaveBeenCalled();
    });

    it('refuses a phone with letters', async () => {
      renderPage();
      const phone = screen.getByLabelText('Phone Number');
      await userEvent.clear(phone);
      await userEvent.type(phone, 'abc');
      await userEvent.click(save());

      expect(await screen.findByText(/Use only digits/)).toBeInTheDocument();
      expect(service.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('when saving fails', () => {
    it('shows the friendly message and keeps what was typed', async () => {
      service.updateProfile.mockRejectedValue(new ProfileError('unknown'));
      renderPage();
      await userEvent.type(name(), 'x');
      await userEvent.click(save());

      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save your profile.");
      expect(name()).toHaveValue('Sam Leex');
      expect(auth.value.refreshAccount).not.toHaveBeenCalled();
      expect(save()).toBeEnabled(); // can try again
    });

    it('says "Profile not found" when the database updated nothing', async () => {
      service.updateProfile.mockRejectedValue(new ProfileError('not_found'));
      renderPage();
      await userEvent.type(name(), 'x');
      await userEvent.click(save());
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Profile not found. Contact support.',
      );
    });
  });

  it('blocks a second click while saving', async () => {
    let finish;
    service.updateProfile.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();
    await userEvent.type(name(), 'x');
    await userEvent.click(save());

    const busy = await screen.findByRole('button', { name: 'Saving…' });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(service.updateProfile).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  describe('an account without a profile row', () => {
    beforeEach(() => {
      auth.value = {
        ...auth.value,
        account: { userId: USER, fullName: null, profileMissing: true, loadFailed: false },
      };
    });

    it('says the profile was not found, offers no form, and still lets them sign out', async () => {
      const onLogout = renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent('Profile not found. Contact support.');
      expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save changes/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /Sign Out/ }));
      expect(onLogout).toHaveBeenCalled();
      expect(await screen.findByTestId('where')).toHaveTextContent('/login');
    });
  });

  describe('when the profile could not be loaded', () => {
    it('says so, offers a retry, and shows no empty form that could overwrite real data', async () => {
      auth.value = {
        ...auth.value,
        account: { userId: USER, fullName: null, profileMissing: false, loadFailed: true },
      };
      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your profile.");
      expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(auth.value.refreshAccount).toHaveBeenCalled();
    });
  });
});
