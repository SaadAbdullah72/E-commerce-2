import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProductImage from './ProductImage';

describe('ProductImage', () => {
  it('shows the picture when there is one', () => {
    render(<ProductImage src="https://res.cloudinary.com/demo/image/upload/a.jpg" alt="Earbuds" />);
    expect(screen.getByRole('img', { name: 'Earbuds' })).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/demo/image/upload/a.jpg',
    );
  });

  it('shows a built-in placeholder (no external request) when there is no picture', () => {
    const { container } = render(<ProductImage src={undefined} alt="Earbuds" />);
    expect(screen.getByRole('img', { name: 'Earbuds' }).tagName).toBe('DIV');
    expect(container.querySelector('img')).toBeNull();
  });

  it('falls back to the placeholder when the picture fails to load', () => {
    const { container } = render(
      <ProductImage src="https://example.com/broken.jpg" alt="Earbuds" />,
    );
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Earbuds' })).toBeInTheDocument();
  });
});
