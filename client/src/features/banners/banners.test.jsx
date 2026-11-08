import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ listLiveBanners: vi.fn() }));
vi.mock('./services/bannerService', () => service);

import HeroSlider from '@/components/home/HeroSlider';

import AnnouncementTicker from './components/AnnouncementTicker';

function renderWithQuery(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const slide = (n, overrides = {}) => ({
  id: `s${n}`,
  badge: `BADGE ${n}`,
  title: `Headline ${n}`,
  subtitle: `Sub ${n}`,
  buttonText: `Button ${n}`,
  linkPath: `/category/electronics${n}`,
  imageUrl: null,
  theme: 'ocean',
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe('HeroSlider', () => {
  it('asks for the hero banners', async () => {
    service.listLiveBanners.mockResolvedValue([slide(1)]);
    renderWithQuery(<HeroSlider />);
    await screen.findByText('Headline 1');
    expect(service.listLiveBanners).toHaveBeenCalledWith('hero');
  });

  it('shows a placeholder while loading', () => {
    service.listLiveBanners.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<HeroSlider />);
    expect(screen.getByRole('status', { name: /loading banner/i })).toBeInTheDocument();
  });

  it('shows the text from the database and links the button to the internal path', async () => {
    service.listLiveBanners.mockResolvedValue([slide(1)]);
    renderWithQuery(<HeroSlider />);

    expect(await screen.findByText('Headline 1')).toBeInTheDocument();
    expect(screen.getByText('BADGE 1')).toBeInTheDocument();
    expect(screen.getByText('Sub 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /button 1/i })).toHaveAttribute(
      'href',
      '/category/electronics1',
    );
  });

  it('leaves out empty parts: no badge, no button without a link', async () => {
    service.listLiveBanners.mockResolvedValue([
      slide(1, { badge: '', subtitle: '', linkPath: '' }),
    ]);
    renderWithQuery(<HeroSlider />);

    await screen.findByText('Headline 1');
    expect(screen.queryByText('Button 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows nothing at all when there are no live slides or the request fails', async () => {
    service.listLiveBanners.mockResolvedValue([]);
    const { container, unmount } = renderWithQuery(<HeroSlider />);
    await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(container).toBeEmptyDOMElement();
    unmount();

    service.listLiveBanners.mockRejectedValue(new Error('x'));
    const second = renderWithQuery(<HeroSlider />);
    await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(second.container).toBeEmptyDOMElement();
  });

  it('only shows the picture when there is one, and never trusts it as markup', async () => {
    service.listLiveBanners.mockResolvedValue([
      slide(1, {
        imageUrl: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/banners/a.jpg',
      }),
      slide(2, { title: '<img src=x onerror=alert(1)>' }),
    ]);
    const { container } = renderWithQuery(<HeroSlider />);

    await screen.findByText('Headline 1');
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); // plain text
  });

  it('has controls only when there is more than one slide, and they change the slide', async () => {
    service.listLiveBanners.mockResolvedValue([slide(1)]);
    const single = renderWithQuery(<HeroSlider />);
    await screen.findByText('Headline 1');
    expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument();
    single.unmount();

    service.listLiveBanners.mockResolvedValue([slide(1), slide(2), slide(3)]);
    const user = userEvent.setup();
    renderWithQuery(<HeroSlider />);
    await screen.findByText('Headline 1');

    const visible = () =>
      screen
        .getAllByRole('heading', { level: 2, hidden: true })
        .filter((heading) => heading.closest('[aria-hidden="false"]'))
        .map((heading) => heading.textContent);

    expect(visible()).toEqual(['Headline 1']);
    await user.click(screen.getByRole('button', { name: /next slide/i }));
    expect(visible()).toEqual(['Headline 2']);
    await user.click(screen.getByRole('button', { name: /previous slide/i }));
    await user.click(screen.getByRole('button', { name: /previous slide/i }));
    expect(visible()).toEqual(['Headline 3']);
    await user.click(screen.getByRole('button', { name: 'Go to slide 2' }));
    expect(visible()).toEqual(['Headline 2']);
  });

  it('rotates by itself', async () => {
    service.listLiveBanners.mockResolvedValue([slide(1), slide(2)]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithQuery(<HeroSlider />);
    await screen.findByText('Headline 1');

    const dots = () => screen.getAllByRole('button', { name: /go to slide/i });
    expect(dots()[0]).toHaveAttribute('aria-current', 'true');
    await act(async () => {
      vi.advanceTimersByTime(4600);
    });
    expect(dots()[1]).toHaveAttribute('aria-current', 'true');
  });
});

describe('AnnouncementTicker', () => {
  it('shows each announcement from the database', async () => {
    service.listLiveBanners.mockResolvedValue([
      { id: 'a', title: 'Free delivery this week', linkPath: '', theme: 'ocean' },
      { id: 'b', title: 'New arrivals', linkPath: '/category/new', theme: 'ocean' },
    ]);
    renderWithQuery(<AnnouncementTicker />);

    const bar = await screen.findByLabelText('Announcements');
    expect(service.listLiveBanners).toHaveBeenCalledWith('announcement');
    // Each message appears twice so the scrolling loop has no gap.
    expect(within(bar).getAllByText('Free delivery this week')).toHaveLength(2);
    expect(within(bar).getAllByRole('link', { name: /new arrivals/i })[0]).toHaveAttribute(
      'href',
      '/category/new',
    );
  });

  it('is left out entirely with nothing to show, while loading, or on error', async () => {
    service.listLiveBanners.mockReturnValue(new Promise(() => {}));
    const loading = renderWithQuery(<AnnouncementTicker />);
    expect(loading.container).toBeEmptyDOMElement();
    loading.unmount();

    service.listLiveBanners.mockResolvedValue([]);
    const empty = renderWithQuery(<AnnouncementTicker />);
    await vi.waitFor(() => expect(service.listLiveBanners).toHaveBeenCalled());
    expect(empty.container).toBeEmptyDOMElement();
    empty.unmount();

    service.listLiveBanners.mockRejectedValue(new Error('x'));
    const failed = renderWithQuery(<AnnouncementTicker />);
    await vi.waitFor(() => expect(service.listLiveBanners).toHaveBeenCalledTimes(3));
    expect(failed.container).toBeEmptyDOMElement();
  });
});
