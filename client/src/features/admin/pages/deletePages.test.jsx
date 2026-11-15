import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  products: [],
  categories: [],
  coupons: [],
  banners: [],
}));
const services = vi.hoisted(() => ({
  deleteProduct: vi.fn(),
  deleteCategory: vi.fn(),
  deleteCoupon: vi.fn(),
  deleteBanner: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('../hooks/useAdminData', () => {
  const result = (rows) => ({ data: rows, isPending: false, isError: false });
  return {
    useAdminProducts: () => result(data.products),
    useAdminCategories: () => result(data.categories),
    useAdminCategory: () => result(null),
    useAdminCoupons: () => result(data.coupons),
    useAdminBanners: () => result(data.banners),
  };
});
vi.mock('../services/productAdminService', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteProduct: services.deleteProduct,
}));
vi.mock('../services/categoryAdminService', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteCategory: services.deleteCategory,
}));
vi.mock('../services/couponAdminService', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteCoupon: services.deleteCoupon,
}));
vi.mock('../services/bannerAdminService', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteBanner: services.deleteBanner,
}));

import BannersPage from './BannersPage';
import CategoriesPage from './CategoriesPage';
import CouponsPage from './CouponsPage';
import ProductsPage from './ProductsPage';

function renderPage(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  data.products = [
    {
      id: 'p1',
      title: 'Desk lamp',
      category: 'Home',
      priceMinor: 1200,
      currency: 'USD',
      stock: 5,
      isActive: true,
      image: null,
    },
  ];
  data.categories = [{ id: 'c1', name: 'Home', slug: 'home', sortOrder: 1, isActive: true }];
  data.coupons = [
    {
      id: 'k1',
      code: 'FRESH10',
      discountType: 'percent',
      percentOff: 10,
      amountOffMinor: null,
      maxDiscountMinor: null,
      minSubtotalMinor: 0,
      startsAt: null,
      expiresAt: null,
      usageLimit: null,
      perUserLimit: 1,
      usedCount: 0,
      isActive: true,
    },
    {
      id: 'k2',
      code: 'USED20',
      discountType: 'percent',
      percentOff: 20,
      amountOffMinor: null,
      maxDiscountMinor: null,
      minSubtotalMinor: 0,
      startsAt: null,
      expiresAt: null,
      usageLimit: null,
      perUserLimit: 1,
      usedCount: 3,
      isActive: true,
    },
  ];
  data.banners = [
    {
      id: 'b1',
      title: 'Summer sale',
      badge: '',
      subtitle: '',
      buttonText: '',
      theme: 'blue',
      imageUrl: null,
      sortOrder: 1,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
  ];
});

/** Each page, how to open its delete dialog, and what its success notice says. */
const PAGES = [
  {
    kind: 'product',
    page: <ProductsPage />,
    trash: 'Delete Desk lamp',
    remove: services.deleteProduct,
    id: 'p1',
    notice: '"Desk lamp" was deleted.',
    refusal:
      'Cannot delete this product because it has associated orders. Please deactivate it instead.',
  },
  {
    kind: 'category',
    page: <CategoriesPage />,
    trash: 'Delete Home',
    remove: services.deleteCategory,
    id: 'c1',
    notice: '"Home" was deleted.',
    refusal:
      'Cannot delete this category because it still has products, including inactive ones. Move or delete them first.',
  },
  {
    kind: 'coupon',
    page: <CouponsPage />,
    trash: 'Delete FRESH10',
    remove: services.deleteCoupon,
    id: 'k1',
    notice: 'FRESH10 was deleted.',
    refusal: 'Cannot delete a used coupon. Pause it instead.',
  },
  {
    kind: 'banner',
    label: 'hero slide',
    page: <BannersPage />,
    trash: 'Delete Summer sale',
    remove: services.deleteBanner,
    id: 'b1',
    notice: '"Summer sale" was deleted.',
    refusal: 'We could not delete the banner. Please try again.',
  },
];

describe.each(PAGES)(
  'Delete a $kind',
  ({ kind, label = kind, page, trash, remove, id, notice, refusal }) => {
    it('asks first, in a red dialog that says it cannot be undone', async () => {
      renderPage(page);
      await userEvent.click(screen.getByRole('button', { name: trash }));

      const dialog = screen.getByRole('alertdialog');
      expect(within(dialog).getByText(`Delete this ${label}?`)).toBeInTheDocument();
      expect(dialog).toHaveTextContent('This cannot be undone.');
      expect(dialog).toHaveTextContent('recorded in the Activity log');
      const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' });
      expect(confirm).toHaveClass('bg-red-600');
      expect(remove).not.toHaveBeenCalled();
    });

    it('does nothing when cancelled', async () => {
      renderPage(page);
      await userEvent.click(screen.getByRole('button', { name: trash }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(remove).not.toHaveBeenCalled();
    });

    it('deletes by id, closes the dialog and shows a notice', async () => {
      remove.mockResolvedValue(undefined);
      renderPage(page);
      await userEvent.click(screen.getByRole('button', { name: trash }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

      expect(await screen.findByText(notice)).toBeInTheDocument();
      expect(remove).toHaveBeenCalledTimes(1);
      expect(remove.mock.calls[0][0]).toBe(id);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('keeps the dialog open and shows the reason when the delete is refused', async () => {
      remove.mockRejectedValue(new Error(refusal));
      renderPage(page);
      await userEvent.click(screen.getByRole('button', { name: trash }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(refusal);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.queryByText(notice)).not.toBeInTheDocument();
    });
  },
);

describe('Used coupons', () => {
  it('have a disabled trash with an explanation, and cannot open the dialog', async () => {
    renderPage(<CouponsPage />);
    const trash = screen.getByRole('button', { name: 'Delete USED20' });

    expect(trash).toBeDisabled();
    expect(trash).toHaveAttribute('title', 'Used coupons cannot be deleted. Pause it instead.');
    await userEvent.click(trash);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('leave unused coupons deletable', () => {
    renderPage(<CouponsPage />);
    expect(screen.getByRole('button', { name: 'Delete FRESH10' })).toBeEnabled();
  });
});
