import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    isAdmin: true,
    user: { email: 'a@b.c' },
    signOut: vi.fn(),
  }),
}));

const lists = vi.hoisted(() => ({
  getCount: vi.fn(),
  listLowStockProducts: vi.fn(),
  listAdminProducts: vi.fn(),
  listAdminCategories: vi.fn(),
}));
const products = vi.hoisted(() => ({
  saveProduct: vi.fn(),
  setProductActive: vi.fn(),
  getAdminProduct: vi.fn(),
  listAdminDealTags: vi.fn(),
}));
const categoriesApi = vi.hoisted(() => ({
  saveCategory: vi.fn(),
  setCategoryActive: vi.fn(),
  countActiveProductsInCategory: vi.fn(),
  getAdminCategory: vi.fn(),
}));
vi.mock('./services/adminService', () => lists);
vi.mock('./services/productAdminService', () => products);
vi.mock('./services/categoryAdminService', () => categoriesApi);

import ProductForm from './components/ProductForm';
import AdminRoutes from './routes';

const CAT_ID = '11111111-1111-4111-8111-111111111111';
const OLD_CAT_ID = '22222222-2222-4222-8222-222222222222';
const TAG_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

const categories = [
  { id: CAT_ID, name: 'Electronics', slug: 'electronics', isActive: true, sortOrder: 1 },
  { id: OLD_CAT_ID, name: 'Retired', slug: 'retired', isActive: false, sortOrder: 2 },
];
const dealTags = [{ id: TAG_ID, name: 'Lightning Deals', isActive: true }];

const productRow = (overrides = {}) => ({
  id: PRODUCT_ID,
  slug: 'earbuds',
  title: 'Earbuds',
  priceMinor: 1299,
  currency: 'USD',
  stock: 40,
  isActive: true,
  category: 'Electronics',
  image: null,
  ...overrides,
});

const formValues = (overrides = {}) => ({
  title: 'Earbuds',
  slug: 'earbuds',
  description: '',
  categoryId: CAT_ID,
  price: '12.99',
  compareAtPrice: '',
  stock: '40',
  sizes: [],
  colors: [],
  dealTagIds: [],
  isActive: true,
  isFlashDeal: false,
  flashEndsAt: '',
  images: [],
  ...overrides,
});

function renderAdmin(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  lists.getCount.mockResolvedValue(0);
  lists.listLowStockProducts.mockResolvedValue([]);
  lists.listAdminProducts.mockResolvedValue([productRow()]);
  lists.listAdminCategories.mockResolvedValue(categories);
  products.listAdminDealTags.mockResolvedValue(dealTags);
  categoriesApi.countActiveProductsInCategory.mockResolvedValue(0);
});

describe('ProductForm', () => {
  const renderForm = (props = {}) => {
    const onSubmit = vi.fn();
    render(
      <ProductForm
        categories={categories}
        dealTags={dealTags}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        {...props}
      />,
    );
    return onSubmit;
  };

  it('shows a message for each missing required field and does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.click(screen.getByRole('button', { name: 'Save product' }));

    expect(await screen.findByText('Enter a title')).toBeInTheDocument();
    expect(screen.getByText('Enter a slug')).toBeInTheDocument();
    // "Choose a category" is both the placeholder option and the error message.
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('Choose a category')).toHaveLength(2);
    expect(screen.getByText(/enter a price like 12\.99/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  });

  it('builds the slug from the title until you edit the slug yourself', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Wireless Earbuds!');
    expect(screen.getByLabelText(/^Slug/)).toHaveValue('wireless-earbuds');

    await user.clear(screen.getByLabelText(/^Slug/));
    await user.type(screen.getByLabelText(/^Slug/), 'my-slug');
    await user.type(screen.getByLabelText('Title'), ' Pro');
    expect(screen.getByLabelText(/^Slug/)).toHaveValue('my-slug');
  });

  it('does not rewrite the slug of an existing product when its title changes', async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: formValues() });

    await user.type(screen.getByLabelText('Title'), ' Pro');
    expect(screen.getByLabelText(/^Slug/)).toHaveValue('earbuds');
  });

  it('sends the payload in whole cents when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText('Title'), 'Wireless Earbuds');
    await user.selectOptions(screen.getByLabelText('Category'), CAT_ID);
    await user.type(screen.getByLabelText('Sale price'), '12.99');
    await user.type(screen.getByLabelText('Original price (optional)'), '49.99');
    await user.clear(screen.getByLabelText('Stock'));
    await user.type(screen.getByLabelText('Stock'), '150');
    await user.click(screen.getByLabelText('Lightning Deals'));
    await user.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      slug: 'wireless-earbuds',
      title: 'Wireless Earbuds',
      category_id: CAT_ID,
      price_minor: 1299,
      compare_at_price_minor: 4999,
      stock: 150,
      deal_tag_ids: [TAG_ID],
      is_active: true,
      is_flash_deal: false,
      flash_ends_at: null,
      images: [],
    });
  });

  it('shows the discount live and rejects an original price below the sale price', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm({ initialValues: formValues() });

    await user.type(screen.getByLabelText('Original price (optional)'), '49.99');
    expect(screen.getByText('Shows as 74% off')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Original price (optional)'));
    await user.type(screen.getByLabelText('Original price (optional)'), '5');
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText(/cannot be lower than the sale price/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('adds and removes sizes and colours, and asks for a flash-deal end date', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm({ initialValues: formValues() });

    await user.type(screen.getByLabelText(/^Sizes/), 'S{Enter}M,');
    expect(screen.getByRole('button', { name: 'Remove S' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove S' }));
    expect(screen.queryByRole('button', { name: 'Remove S' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add colour/i }));
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Colour needs a name')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Colour 1 name'), 'Red');

    await user.click(screen.getByLabelText('Flash deal'));
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Choose when the flash deal ends')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps an inactive category selectable when the product already uses it', () => {
    renderForm({ initialValues: formValues({ categoryId: OLD_CAT_ID }) });
    const select = screen.getByLabelText('Category');
    expect(within(select).getByRole('option', { name: 'Retired (inactive)' })).toBeInTheDocument();
    expect(select).toHaveValue(OLD_CAT_ID);
  });

  it('hides an inactive category from a new product', () => {
    renderForm();
    expect(screen.queryByRole('option', { name: /retired/i })).not.toBeInTheDocument();
  });

  it('shows a server error and blocks saving while images are uploading', async () => {
    const user = userEvent.setup();
    const uploadFn = vi.fn(() => new Promise(() => {}));
    renderForm({
      initialValues: formValues(),
      serverError: 'That slug is already taken.',
      uploadFn,
    });

    expect(screen.getByRole('alert', { name: '' })).toHaveTextContent(
      'That slug is already taken.',
    );

    await user.upload(
      screen.getByLabelText('Upload images'),
      new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByRole('button', { name: 'Uploading images...' })).toBeDisabled();
  });

  it('shows "Saving..." and disables the button while saving', () => {
    renderForm({ initialValues: formValues(), isSaving: true });
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});

describe('add product page', () => {
  it('saves a new product and returns to the list with a confirmation', async () => {
    products.saveProduct.mockResolvedValue(PRODUCT_ID);
    const user = userEvent.setup();
    renderAdmin('/admin/products/new');

    await user.type(await screen.findByLabelText('Title'), 'New Lamp');
    await user.selectOptions(screen.getByLabelText('Category'), CAT_ID);
    await user.type(screen.getByLabelText('Sale price'), '20');
    await user.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(products.saveProduct).toHaveBeenCalledTimes(1));
    expect(products.saveProduct.mock.calls[0][0]).toBeNull();
    expect(products.saveProduct.mock.calls[0][1]).toMatchObject({
      title: 'New Lamp',
      slug: 'new-lamp',
      price_minor: 2000,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Product added.');
    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();
  });

  it('stays on the form and shows the reason when saving fails', async () => {
    products.saveProduct.mockRejectedValue(
      new Error('That slug is already taken. Choose a different one.'),
    );
    const user = userEvent.setup();
    renderAdmin('/admin/products/new');

    await user.type(await screen.findByLabelText('Title'), 'New Lamp');
    await user.selectOptions(screen.getByLabelText('Category'), CAT_ID);
    await user.type(screen.getByLabelText('Sale price'), '20');
    await user.click(screen.getByRole('button', { name: 'Save product' }));

    expect(await screen.findByText(/slug is already taken/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add product' })).toBeInTheDocument();
  });
});

describe('edit product page', () => {
  it('loads the product, saves changes against its id', async () => {
    products.getAdminProduct.mockResolvedValue(formValues({ title: 'Earbuds', price: '12.99' }));
    products.saveProduct.mockResolvedValue(PRODUCT_ID);
    const user = userEvent.setup();
    renderAdmin(`/admin/products/${PRODUCT_ID}`);

    const price = await screen.findByLabelText('Sale price');
    expect(price).toHaveValue('12.99');
    expect(screen.getByRole('heading', { name: 'Edit product' })).toBeInTheDocument();

    await user.clear(price);
    await user.type(price, '9.50');
    await user.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(products.saveProduct).toHaveBeenCalledTimes(1));
    expect(products.saveProduct.mock.calls[0][0]).toBe(PRODUCT_ID);
    expect(products.saveProduct.mock.calls[0][1]).toMatchObject({ price_minor: 950 });
    expect(await screen.findByRole('status')).toHaveTextContent('Product saved.');
  });

  it('says so when the product does not exist', async () => {
    products.getAdminProduct.mockResolvedValue(null);
    renderAdmin(`/admin/products/${PRODUCT_ID}`);
    expect(await screen.findByText('This product does not exist.')).toBeInTheDocument();
  });

  it('shows an error with retry when loading fails', async () => {
    products.getAdminProduct.mockRejectedValue(new Error('x'));
    renderAdmin(`/admin/products/${PRODUCT_ID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the product form/i);
  });
});

describe('deactivating and restoring products', () => {
  it('asks first, then soft-deletes only that product', async () => {
    products.setProductActive.mockResolvedValue();
    const user = userEvent.setup();
    renderAdmin('/admin/products');

    await user.click(await screen.findByRole('button', { name: 'Deactivate Earbuds' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/hidden from the shop/i);
    expect(dialog).toHaveTextContent(/nothing is deleted/i);
    expect(products.setProductActive).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(products.setProductActive).toHaveBeenCalledWith(PRODUCT_ID, false));
    expect(await screen.findByRole('status')).toHaveTextContent('"Earbuds" was deactivated.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does nothing when you cancel', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin/products');

    await user.click(await screen.findByRole('button', { name: 'Deactivate Earbuds' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(products.setProductActive).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('restores an inactive product', async () => {
    lists.listAdminProducts.mockResolvedValue([productRow({ isActive: false })]);
    products.setProductActive.mockResolvedValue();
    const user = userEvent.setup();
    renderAdmin('/admin/products');

    await user.click(await screen.findByRole('button', { name: 'Restore Earbuds' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
    );

    await waitFor(() => expect(products.setProductActive).toHaveBeenCalledWith(PRODUCT_ID, true));
  });

  it('keeps the dialog open and shows the reason if it fails', async () => {
    products.setProductActive.mockRejectedValue(new Error('We could not deactivate the product.'));
    const user = userEvent.setup();
    renderAdmin('/admin/products');

    await user.click(await screen.findByRole('button', { name: 'Deactivate Earbuds' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    );

    expect(await screen.findByText('We could not deactivate the product.')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('categories', () => {
  it('adds a category from a dialog', async () => {
    categoriesApi.saveCategory.mockResolvedValue('new-id');
    const user = userEvent.setup();
    renderAdmin('/admin/categories');

    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog', { name: 'Add category' });
    await user.type(within(dialog).getByLabelText('Name'), 'Garden Tools');
    expect(within(dialog).getByLabelText(/^Slug/)).toHaveValue('garden-tools');
    await user.click(within(dialog).getByRole('button', { name: 'Save category' }));

    await waitFor(() => expect(categoriesApi.saveCategory).toHaveBeenCalledTimes(1));
    expect(categoriesApi.saveCategory.mock.calls[0][0]).toBeNull();
    expect(categoriesApi.saveCategory.mock.calls[0][1]).toEqual({
      name: 'Garden Tools',
      slug: 'garden-tools',
      sort_order: 0,
      is_active: true,
      icon_url: null,
      icon_public_id: null,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Category added.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('edits an existing category after loading it', async () => {
    categoriesApi.getAdminCategory.mockResolvedValue({
      name: 'Electronics',
      slug: 'electronics',
      sortOrder: '1',
      isActive: true,
      icon: [],
    });
    categoriesApi.saveCategory.mockResolvedValue(CAT_ID);
    const user = userEvent.setup();
    renderAdmin('/admin/categories');

    await user.click(await screen.findByRole('button', { name: 'Edit Electronics' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit category' });
    const name = await within(dialog).findByLabelText('Name');
    expect(name).toHaveValue('Electronics');
    await user.clear(name);
    await user.type(name, 'Gadgets');
    expect(within(dialog).getByLabelText(/^Slug/)).toHaveValue('electronics'); // slug not rewritten
    await user.click(within(dialog).getByRole('button', { name: 'Save category' }));

    await waitFor(() => expect(categoriesApi.saveCategory).toHaveBeenCalled());
    expect(categoriesApi.saveCategory.mock.calls[0][0]).toBe(CAT_ID);
    expect(categoriesApi.saveCategory.mock.calls[0][1]).toMatchObject({ name: 'Gadgets' });
  });

  it('warns how many live products a deactivated category affects', async () => {
    categoriesApi.countActiveProductsInCategory.mockResolvedValue(3);
    categoriesApi.setCategoryActive.mockResolvedValue();
    const user = userEvent.setup();
    renderAdmin('/admin/categories');

    await user.click(await screen.findByRole('button', { name: 'Deactivate Electronics' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('3 active products are in this category');

    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(categoriesApi.setCategoryActive).toHaveBeenCalledWith(CAT_ID, false),
    );
  });

  it('validates the form before saving', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin/categories');

    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    await user.click(screen.getByRole('button', { name: 'Save category' }));

    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(categoriesApi.saveCategory).not.toHaveBeenCalled();
  });
});
