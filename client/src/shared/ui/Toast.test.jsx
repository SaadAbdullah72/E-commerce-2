import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from './Toast';
import { useToast } from './useToast';

function Buttons() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success('Saved')}>
        ok
      </button>
      <button type="button" onClick={() => toast.error('Could not save')}>
        fail
      </button>
      <button type="button" onClick={() => toast.info('FYI')}>
        info
      </button>
    </>
  );
}

const setup = () =>
  render(
    <ToastProvider>
      <Buttons />
    </ToastProvider>,
  );

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('shows success and info as polite status messages, errors as alerts', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.click(screen.getByRole('button', { name: 'fail' }));
    await user.click(screen.getByRole('button', { name: 'info' }));
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('dismisses itself: success after 5s, error after 8s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.click(screen.getByRole('button', { name: 'fail' }));

    act(() => vi.advanceTimersByTime(5100));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Could not save')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText('Could not save')).not.toBeInTheDocument();
  });

  it('can be dismissed by hand', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('stays open while the mouse is over it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.hover(screen.getByText('Saved'));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows at most 3 at once (the oldest goes first)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    const ok = screen.getByRole('button', { name: 'ok' });
    await user.click(ok);
    await user.click(screen.getByRole('button', { name: 'info' }));
    await user.click(screen.getByRole('button', { name: 'fail' }));
    await user.click(screen.getByRole('button', { name: 'info' }));
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(3);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('useToast does nothing (and does not throw) without a provider', async () => {
    render(<Buttons />);
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
