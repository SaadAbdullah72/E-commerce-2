import { Ban, Package, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import ProductImage from '@/features/catalog/components/ProductImage';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { formatMoney } from '@/shared/lib/formatMoney';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { Card } from '@/shared/ui/Card';
import { Input, Select } from '@/shared/ui/Input';
import PageHeader from '@/shared/ui/PageHeader';
import { Td, Th, Tr } from '@/shared/ui/Table';

import DeleteButton from '../components/DeleteButton';
import DeleteConfirm from '../components/DeleteConfirm';
import IconAction from '../components/IconAction';
import NoticeBanner from '../components/NoticeBanner';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import StockMeter from '../components/StockMeter';
import { useAdminProducts } from '../hooks/useAdminData';
import { useDeleteProduct, useSetProductActive } from '../hooks/useAdminMutations';
import { stockStatus } from '../lib/adminStats';

const STOCK_BADGE = {
  out: { tone: 'red', text: 'Out of stock' },
  low: { tone: 'amber', text: 'Low stock' },
  ok: { tone: 'green', text: 'In stock' },
};

export default function ProductsPage() {
  const query = useAdminProducts();
  const setActive = useSetProductActive();
  const remove = useDeleteProduct();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pending, setPending] = useState(null); // the product being deactivated / restored
  const [deleting, setDeleting] = useState(null); // the product being deleted
  const [notice, setNotice] = useState(location.state?.notice ?? '');

  const needle = search.trim().toLowerCase();
  const products = (query.data ?? []).filter(
    (product) =>
      (status === 'all' || (status === 'active') === product.isActive) &&
      (!needle || product.title.toLowerCase().includes(needle)),
  );

  const confirm = () => {
    const target = pending;
    setActive.mutate(
      { id: target.id, isActive: !target.isActive },
      {
        onSuccess: () => {
          setNotice(
            target.isActive
              ? `"${target.title}" was deactivated.`
              : `"${target.title}" was restored.`,
          );
          setPending(null);
        },
      },
    );
  };

  const confirmDelete = () => {
    const target = deleting;
    remove.mutate(target.id, {
      onSuccess: () => {
        setNotice(`"${target.title}" was deleted.`);
        setDeleting(null);
      },
    });
  };

  const addProduct = (
    <Link to="/admin/products/new" className={buttonClass()}>
      <Plus size={16} aria-hidden="true" />
      Add product
    </Link>
  );

  return (
    <section className="space-y-4">
      <PageHeader
        title="Products"
        description="Deactivated products are hidden from the shop. A product can only be deleted if it was never ordered."
        action={addProduct}
      />

      <Card className="flex flex-wrap items-center gap-3 !p-3 sm:!p-4">
        <div className="min-w-0 flex-1 basis-64">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            leadingIcon={<Search size={16} />}
          />
        </div>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="!w-auto"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Card>

      {notice && <NoticeBanner onDismiss={() => setNotice('')}>{notice}</NoticeBanner>}

      <Card flush className="relative overflow-x-auto">
        <QueryState
          query={query}
          label="products"
          isEmpty={products.length === 0}
          emptyIcon={Package}
          emptyText={
            query.data?.length ? 'No products match your filters.' : 'There are no products yet.'
          }
          emptyAction={query.data?.length ? undefined : addProduct}
        >
          <table className="w-full min-w-170 text-left text-sm">
            <caption className="sr-only">Products</caption>
            <thead className="bg-gray-50">
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th>Status</Th>
                <Th className="max-md:sticky max-md:right-0 max-md:bg-gray-50">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const badge = STOCK_BADGE[stockStatus(product.stock)];
                return (
                  <Tr key={product.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={product.image}
                          alt={product.title}
                          className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-contain"
                        />
                        <div className="min-w-0">
                          <span className="block font-semibold text-gray-900">{product.title}</span>
                          {product.slug && (
                            <span className="block truncate text-xs text-gray-500">{product.slug}</span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-gray-600">{product.category || '-'}</Td>
                    <Td numeric className="text-gray-900">
                      {formatMoney(product.priceMinor, product.currency)}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-gray-700">{product.stock}</span>
                          <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                        </div>
                        <StockMeter stock={product.stock} />
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge tone={product.isActive ? 'green' : 'gray'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </Td>
                    <Td align="right" className="whitespace-nowrap max-md:sticky max-md:right-0 max-md:bg-white max-md:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                      <div className="flex items-center justify-end gap-1">
                        <IconAction
                          to={`/admin/products/${product.id}`}
                          label={`Edit ${product.title}`}
                          tip="Edit"
                          icon={Pencil}
                          tone="blue"
                        />
                        <IconAction
                          onClick={() => {
                            setActive.reset();
                            setPending(product);
                          }}
                          label={`${product.isActive ? 'Deactivate' : 'Restore'} ${product.title}`}
                          tip={product.isActive ? 'Deactivate' : 'Restore'}
                          icon={product.isActive ? Ban : RotateCcw}
                          tone={product.isActive ? 'red' : 'green'}
                        />
                        <DeleteButton
                          label={product.title}
                          onClick={() => {
                            remove.reset();
                            setDeleting(product);
                          }}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        </QueryState>
      </Card>

      {pending && (
        <ConfirmDialog
          title={pending.isActive ? 'Deactivate this product?' : 'Restore this product?'}
          confirmLabel={pending.isActive ? 'Deactivate' : 'Restore'}
          danger={pending.isActive}
          busy={setActive.isPending}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        >
          <p>
            <strong>{pending.title}</strong>{' '}
            {pending.isActive
              ? 'will be hidden from the shop. Nothing is deleted, and you can restore it any time.'
              : 'will appear in the shop again.'}
          </p>
          {setActive.isError && (
            <p role="alert" className="mt-2 text-red-600">
              {setActive.error.message}
            </p>
          )}
        </ConfirmDialog>
      )}

      {deleting && (
        <DeleteConfirm
          name={deleting.title}
          kind="product"
          busy={remove.isPending}
          error={remove.isError ? remove.error.message : ''}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
