import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import MediaGrid from './MediaGrid';
import RatingSummary from './RatingSummary';
import ReviewCard from './ReviewCard';

const CLD = 'https://res.cloudinary.com/demo';
const photo = (n) => ({ id: `p${n}`, type: 'photo', url: `${CLD}/image/upload/v1/r/photo/${n}.jpg` });
const video = { id: 'v1', type: 'video', url: `${CLD}/video/upload/v1/r/video/a.mp4`, durationSeconds: 12 };

describe('MediaGrid', () => {
  it('shows nothing for a review without media', () => {
    const { container } = render(<MediaGrid media={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a photo in the lightbox, moves with the buttons and the arrow keys, and closes with Escape', async () => {
    render(<MediaGrid media={[photo(1), photo(2), video]} />);
    const opener = screen.getByRole('button', { name: 'Open photo 1' });
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Photo 1 of 2' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus(); // focus goes back to where it was
  });

  it('opens the video in its own box that closes with Escape, with controls', async () => {
    const { container } = render(<MediaGrid media={[photo(1), video]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Play customer video' }));
    expect(screen.getByRole('dialog', { name: 'Customer video' })).toBeInTheDocument();
    const player = container.ownerDocument.querySelector('video');
    expect(player).toHaveAttribute('controls');
    expect(player.getAttribute('src')).toBe(video.url);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Tab inside the open box', async () => {
    render(<MediaGrid media={[photo(1), photo(2)]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open photo 1' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const next = screen.getByRole('button', { name: 'Next photo' });
    next.focus();
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(next).toHaveFocus();
  });

  it('puts media beyond two rows behind "Show all"', async () => {
    const many = Array.from({ length: 10 }, (_v, i) => photo(i + 1));
    render(<MediaGrid media={many} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: 'Show all (10)' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });
});

describe('ReviewCard', () => {
  const review = {
    id: 'r1',
    rating: 4,
    title: 'Solid',
    comment: 'Line one\nLine two',
    authorName: 'Sam L.',
    verified: true,
    createdAt: '2030-01-01T10:00:00Z',
    media: [],
  };

  it('shows the name, a Verified Purchase badge, the stars and the text', () => {
    render(<ReviewCard review={review} />);
    expect(screen.getByText('Sam L.')).toBeInTheDocument();
    expect(screen.getByText('Verified Purchase')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
    expect(screen.getByText(/Line one/)).toHaveClass('whitespace-pre-line');
  });

  it('has no Verified Purchase badge when the purchase is not confirmed', () => {
    render(<ReviewCard review={{ ...review, verified: false }} />);
    expect(screen.queryByText('Verified Purchase')).not.toBeInTheDocument();
  });

  it('labels the customer own review that is not public yet', () => {
    const { rerender } = render(<ReviewCard review={review} status="pending" />);
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    rerender(<ReviewCard review={review} status="rejected" />);
    expect(screen.getByText('Not approved')).toBeInTheDocument();
    rerender(<ReviewCard review={review} status="approved" />);
    expect(screen.queryByText('Awaiting approval')).not.toBeInTheDocument();
    expect(screen.queryByText('Not approved')).not.toBeInTheDocument();
  });

  it('shows text as plain text, never as markup', () => {
    const { container } = render(
      <ReviewCard
        review={{ ...review, authorName: '<b>x</b>', title: '<i>t</i>', comment: '<img src=x onerror=alert(1)>' }}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('i')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});

describe('RatingSummary', () => {
  const summary = { average: 4.25, count: 4, stars: { 5: 2, 4: 1, 3: 1, 2: 0, 1: 0 } };

  it('is hidden when there are no reviews', () => {
    const { container } = render(
      <RatingSummary summary={{ average: 0, count: 0, stars: {} }} selected={null} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the average, the count and one bar per star', () => {
    render(<RatingSummary summary={summary} selected={null} onSelect={() => {}} />);
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('4 reviews')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 stars: 2 reviews' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 star: 0 reviews' })).toBeDisabled();
  });

  it('filters by a star on click and clears the filter on a second click', async () => {
    const picks = [];
    const { rerender } = render(
      <RatingSummary summary={summary} selected={null} onSelect={(value) => picks.push(value)} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '5 stars: 2 reviews' }));
    rerender(<RatingSummary summary={summary} selected={5} onSelect={(value) => picks.push(value)} />);
    const bar = screen.getByRole('button', { name: '5 stars: 2 reviews, selected' });
    expect(bar).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(bar);
    expect(picks).toEqual([5, null]);
  });
});
