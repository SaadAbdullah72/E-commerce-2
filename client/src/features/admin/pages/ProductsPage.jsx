import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import ProductImage from '@/features/catalog/components/ProductImage';
import { formatMoney } from '@/shared/lib/formatMoney';

import ConfirmDialog from '../components/ConfirmDialog';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminProducts } from '../hooks/useAdminData';
import { useSetProductActive } from '../hooks/useAdminMutations';
import { stockStatus } from '../lib/adminStats';

const STOCK_BADGE = {
  out: { tone: 'red', text: 'Out of stock' },
  low: { tone: 'amber', text: 'Low stock' },
  ok: { tone: 'green', text: 'In stock' },
};

export default function ProductsPage() {
  const query = useAdminProducts();
  const setActive = useSetProductActive();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pending, setPending] = useState(null); // the product being deactivated / restored
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Products</h2>
          <p className="text-xs text-gray-500">
            Deactivated products are hidden from the shop but never deleted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Link
            to="/admin/products/new"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Add product
          </Link>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice('')}
            className="cursor-pointer text-xs font-bold underline"
          >
            Dismiss
          </button>
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
        <QueryState
          query={query}
          label="products"
          isEmpty={products.length === 0}
          emptyText={
            query.data?.length ? 'No products match your filters.' : 'There are no products yet.'
          }
        >
          <table className="w-full min-w-170 text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Product</th>
                <th className="px-4 py-2 font-semibold">Category</th>
                <th className="px-4 py-2 font-semibold">Price</th>
                <th className="px-4 py-2 font-semibold">Stock</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const badge = STOCK_BADGE[stockStatus(product.stock)];
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={product.image}
                          alt={product.title}
                          className="h-10 w-10 shrink-0 rounded border border-gray-200 object-contain"
                        />
                        <span className="font-semibold text-gray-900">{product.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{product.category || '-'}</td>
                    <td className="px-4 py-2 text-gray-900">
                      {formatMoney(product.priceMinor, product.currency)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="mr-2 text-gray-700">{product.stock}</span>
                      <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge tone={product.isActive ? 'green' : 'gray'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/products/${product.id}`}
                        aria-label={`Edit ${product.title}`}
                        className="mr-3 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setActive.reset();
                          setPending(product);
                        }}
                        aria-label={`${product.isActive ? 'Deactivate' : 'Restore'} ${product.title}`}
                        className={`cursor-pointer text-xs font-bold hover:underline ${
                          product.isActive ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        {product.isActive ? 'Deactivate' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </QueryState>
      </div>

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
    </section>
  );
}
