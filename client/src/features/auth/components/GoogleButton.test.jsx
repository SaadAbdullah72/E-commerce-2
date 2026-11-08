import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }));
vi.mock('../services/oauthService', () => service);

import GoogleButton from './GoogleButton';

beforeEach(() => vi.resetAllMocks());

describe('GoogleButton', () => {
  it('starts Google sign-in with the given destination and shows a busy state', async () => {
    const user = userEvent.setup();
    service.signInWithGoogle.mockResolvedValue({ ok: true });
    render(<GoogleButton redirectPath="shipping" />);

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(service.signInWithGoogle).toHaveBeenCalledWith('shipping');
    const busy = screen.getByRole('button', { name: /connecting to google/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('ignores a second click while starting', async () => {
    const user = userEvent.setup();
    service.signInWithGoogle.mockReturnValue(new Promise(() => {}));
    render(<GoogleButton />);

    const button = screen.getByRole('button', { name: 'Continue with Google' });
    await user.dblClick(button);

    expect(service.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('re-enables and reports the error when it cannot start', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const error = { code: 'network', message: "Can't reach the server." };
    service.signInWithGoogle.mockResolvedValue({ ok: false, error });
    render(<GoogleButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(onError).toHaveBeenCalledWith(error);
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });

  it('can be disabled by the parent form', () => {
    render(<GoogleButton disabled />);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  });
});
