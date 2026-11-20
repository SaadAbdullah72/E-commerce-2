import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ConfirmDialog from '@/shared/components/ConfirmDialog';

import Modal from './Modal';

function Harness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Other</button>
      {open && (
        <Modal
          title="Edit thing"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          footer={<button type="button">Save</button>}
        >
          <input aria-label="Name" />
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('is a labelled dialog with a close button', () => {
    render(
      <Modal title="Edit thing" onClose={() => {}}>
        body
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit thing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes on Escape, on the X and on a click on the backdrop', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="T" onClose={onClose}>
        body
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(container.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when the panel itself is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="T" onClose={onClose}>
        <p>inside</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus in, keeps Tab inside, and gives focus back on close', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);

    // first focusable inside is the close button
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await userEvent.tab(); // Name input
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.tab(); // Save
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await userEvent.tab(); // wraps to Close, not to the page behind
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps backwards to Save
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('locks page scroll while open and releases it on close', async () => {
    render(<Harness />);
    expect(document.body.style.overflow).not.toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('a new onClose from the parent does not move focus again', async () => {
    const { rerender } = render(
      <Modal title="T" onClose={() => {}}>
        <input aria-label="Name" />
      </Modal>,
    );
    await userEvent.tab();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    rerender(
      <Modal title="T" onClose={() => {}}>
        <input aria-label="Name" />
      </Modal>,
    );
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('is an alertdialog; focus starts on Cancel; Escape cancels', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="Delete it?" confirmLabel="Delete" onConfirm={() => {}} onCancel={onCancel}>
        This cannot be undone.
      </ConfirmDialog>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Delete it?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirms and cancels with the right callbacks', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="T" confirmLabel="Delete" danger onConfirm={onConfirm} onCancel={onCancel}>
        x
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('while busy the confirm button says Working... and cannot be clicked again', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog title="T" confirmLabel="Delete" busy onConfirm={onConfirm} onCancel={() => {}}>
        x
      </ConfirmDialog>,
    );
    const button = screen.getByRole('button', { name: 'Working...' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
