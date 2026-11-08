import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';
import { electronics, homeKitchen, lightning, productRow } from '@/test/fixtures/catalog';
import { mapCategory, mapDealTag, mapProduct } from '@/features/catalog/lib/mapProduct';

const service = vi.hoisted(() => ({
  listProducts: vi.fn(),
  getProductBySlug: vi.fn(),
  listCategories: vi.fn(),
  listDealTags: vi.fn(),
}));
vi.mock('@/features/catalog/services/catalogService', () => service);
vi.mock('@/components/home/HeroSlider', () => ({ default: () => <div>hero</div> }));

import CategoryPage from './CategoryPage';
import HomePage from './HomePage';
import ProductDetailPage from './ProductDetailPage';

const earbuds = mapProduct(productRow());
const blender = mapProduct(
  productRow({
    id: 'prod-3',
    slug: 'portable-mini-blender',
    title: 'Portable USB Mini Blender',
    price_minor: 1699,
    compare_at_price_minor: null,
    category: homeKitchen,
  }),
);

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  service.listCategories.mockResolvedValue([electronics, homeKitchen].map(mapCategory));
  service.listDealTags.mockResolvedValue([mapDealTag(lightning)]);
});

describe('HomePage', () => {
  function renderHome(props = {}, route = '/') {
    return renderWithProviders(
      <HomePage onSelectProduct={vi.fn()} selectedCategory={null} onSelectCategory={vi.fn()} {...props} />,
      { route },
    );
  }

  it('shows skeletons while loading, then the products with formatted prices', async () => {
    service.listProducts.mockResolvedValue([earbuds, blender]);
    renderHome();

    expect(screen.getByRole('status', { name: 'Loading products' })).toBeInTheDocument();

    expect(await screen.findByText(earbuds.title)).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText('-74%')).toBeInTheDocument();
    expect(screen.getByText('$16.99')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading products' })).not.toBeInTheDocument();
  });

  it('hides the discount badge and the old price when there is no discount', async () => {
    service.listProducts.mockResolvedValue([blender]);
    renderHome();

    await screen.findByText(blender.title);
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it('does not invent ratings for products without reviews', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderHome();

    await screen.findByText(earbuds.title);
    expect(screen.queryByText('(120)')).not.toBeInTheDocument();
    expect(screen.queryByText('4.8')).not.toBeInTheDocument();
  });

  it('shows the placeholder instead of a broken image for products without pictures', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    const { container } = renderHome();

    await screen.findByText(earbuds.title);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: earbuds.title })).toBeInTheDocument();
  });

  it('shows an empty state when there are no products', async () => {
    service.listProducts.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText('No products yet')).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    const user = userEvent.setup();
    service.listProducts.mockRejectedValueOnce(new Error('x')).mockResolvedValue([earbuds]);
    renderHome();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the products.");
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(earbuds.title)).toBeInTheDocument();
  });

  it('lists the categories from the database', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderHome();

    expect(await screen.findByRole('button', { name: 'Home & Kitchen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Electronics' })).toBeInTheDocument();
  });

  it('turns a picked category into a database filter', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderHome({ selectedCategory: 'Electronics' });

    await screen.findByText(earbuds.title);
    expect(service.listProducts).toHaveBeenCalledWith({ categoryId: 'cat-1' });
    expect(screen.getByText('Found 1 item(s)')).toBeInTheDocument();
  });

  it('turns a picked deal into a database filter', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderHome({ selectedCategory: 'Lightning Deals' });

    await screen.findByText(earbuds.title);
    expect(service.listProducts).toHaveBeenCalledWith({ dealTagId: 'tag-1' });
  });

  it('searches in the database by ?keyword=', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderHome({}, '/?keyword=earbuds');

    await screen.findByText(earbuds.title);
    expect(service.listProducts).toHaveBeenCalledWith({ keyword: 'earbuds' });
  });

  it('shows "no results" for a search without matches', async () => {
    service.listProducts.mockResolvedValue([]);
    renderHome({}, '/?keyword=zzz');

    expect(await screen.findByText('No products found for "zzz"')).toBeInTheDocument();
  });

  it('does not query for a label that matches nothing', async () => {
    renderHome({ selectedCategory: 'Mystery Deals' });

    expect(await screen.findByText('No products found for "Mystery Deals"')).toBeInTheDocument();
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it('only shows the flash-deal banner for a real, future flash deal', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    service.listProducts.mockResolvedValue([
      mapProduct(productRow({ is_flash_deal: true, flash_ends_at: future })),
    ]);
    renderHome();
    expect(await screen.findByText('Flash Deals')).toBeInTheDocument();
  });

  it('hides the flash-deal banner when no deal is running', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderHome();

    await screen.findByText(earbuds.title);
    expect(screen.queryByText('Flash Deals')).not.toBeInTheDocument();
  });
});

describe('CategoryPage', () => {
  function renderCategory(categoryName) {
    return renderWithProviders(
      <CategoryPage
        categoryName={categoryName}
        onSelectProduct={vi.fn()}
        onNavigateHome={vi.fn()}
        onSelectCategory={vi.fn()}
      />,
    );
  }

  it('finds the category by slug and lists its products', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderCategory('electronics');

    expect(await screen.findByText(earbuds.title)).toBeInTheDocument();
    expect(service.listProducts).toHaveBeenCalledWith({ categoryId: 'cat-1' });
    expect(screen.getByRole('heading', { name: 'Electronics' })).toBeInTheDocument();
    expect(screen.getByText('1 products')).toBeInTheDocument();
  });

  it('still understands older links that used the lower-cased name', async () => {
    service.listProducts.mockResolvedValue([blender]);
    renderCategory('home & kitchen');

    expect(await screen.findByText(blender.title)).toBeInTheDocument();
    expect(service.listProducts).toHaveBeenCalledWith({ categoryId: 'cat-2' });
  });

  it('marks the current category in the sidebar', async () => {
    service.listProducts.mockResolvedValue([earbuds]);
    renderCategory('electronics');

    await screen.findByText(earbuds.title);
    expect(screen.getByRole('button', { name: 'Electronics' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home & Kitchen' })).not.toHaveAttribute('aria-current');
  });

  it('shows "category not found" for an unknown category without loading products', async () => {
    renderCategory('nope');

    expect(await screen.findByText('Category not found')).toBeInTheDocument();
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it('shows an empty state for a category without products', async () => {
    service.listProducts.mockResolvedValue([]);
    renderCategory('electronics');

    expect(await screen.findByText('No products found')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    service.listProducts.mockRejectedValue(new Error('x'));
    renderCategory('electronics');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load this category.");
  });
});

describe('ProductDetailPage', () => {
  function renderDetail(slug) {
    return renderWithProviders(<ProductDetailPage isLoggedIn={false} />, {
      route: `/product/${slug}`,
      path: '/product/:slug',
    });
  }

  it('loads the product named in the URL', async () => {
    service.getProductBySlug.mockResolvedValue(earbuds);
    renderDetail('wireless-bluetooth-earbuds');

    expect(screen.getByRole('status', { name: 'Loading product' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: earbuds.title })).toBeInTheDocument();
    expect(service.getProductBySlug).toHaveBeenCalledWith('wireless-bluetooth-earbuds');
    expect(screen.getByText('$12.99')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText('-74% OFF')).toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('shows colour and size options from the database', async () => {
    service.getProductBySlug.mockResolvedValue(
      mapProduct(
        productRow({ sizes: ['S', 'M'], colors: [{ name: 'Red', hex: '#FF0000' }] }),
      ),
    );
    renderDetail('wireless-bluetooth-earbuds');

    expect(await screen.findByRole('button', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
  });

  it('adds the product to the cart', async () => {
    const user = userEvent.setup();
    service.getProductBySlug.mockResolvedValue(earbuds);
    renderDetail('wireless-bluetooth-earbuds');

    await user.click(await screen.findByRole('button', { name: /add to cart/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('shopyaro_cart'));
      expect(stored[0]).toMatchObject({ _id: 'prod-1', price: 12.99, quantity: 1 });
    });
  });

  it('shows "not found" for an unknown product', async () => {
    service.getProductBySlug.mockResolvedValue(null);
    renderDetail('missing');

    expect(await screen.findByText('Product not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it('shows an error with retry when loading fails', async () => {
    service.getProductBySlug.mockRejectedValue(new Error('x'));
    renderDetail('wireless-bluetooth-earbuds');

    expect(await screen.findByRole('alert')).toHaveTextContent("We could not load this product.");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
