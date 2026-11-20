import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button';
import { buttonClass } from './buttonStyles';

describe('Button', () => {
  it('is a type="button" by default so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('while loading: shows the loading text, is disabled, is busy, and does not click', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Loading...' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('can say something else while loading', () => {
    render(
      <Button loading loadingText="Working...">
        Delete
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Working...' })).toBeInTheDocument();
  });

  it('an icon-only button is named by its aria-label and is square', () => {
    render(
      <Button iconOnly aria-label="Edit product">
        <svg aria-hidden="true" />
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Edit product' });
    expect(button.className).toContain('aspect-square');
  });

  it('is disabled when asked to be', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('buttonClass', () => {
  it('has the sizes and variants of the spec', () => {
    expect(buttonClass({ size: 'sm' })).toContain('h-8 px-3');
    expect(buttonClass({ size: 'md' })).toContain('h-10 px-4');
    expect(buttonClass({ size: 'lg' })).toContain('h-11 px-6');
    expect(buttonClass({ variant: 'primary' })).toContain('bg-blue-600');
    expect(buttonClass({ variant: 'danger' })).toContain('bg-red-600');
    expect(buttonClass({ variant: 'secondary' })).toContain('border-gray-300');
    expect(buttonClass({ variant: 'ghost' })).toContain('hover:bg-gray-100');
  });

  it('keeps a 44px touch target on phones', () => {
    expect(buttonClass({ size: 'md' })).toContain('max-md:min-h-11');
  });
});
