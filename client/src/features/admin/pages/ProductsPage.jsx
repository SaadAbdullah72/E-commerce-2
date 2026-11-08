import { useState } from 'react';

import ProductImage from '@/features/catalog/components/ProductImage';
import { formatMoney } from '@/shared/lib/formatMoney';

import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminProducts } from '../hooks/useAdminData';
import { stockStatus } from '../lib/adminStats';

const STOCK_BADGE = {
  out: { tone: 'red', text: 'Out of stock' },
  low: { tone: 'amber', text: 'Low stock' },
  ok: { tone: 'green', text: 'In stock' },
};

export default function ProductsPage() {
  const query = useAdminProducts();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const needle = search.trim().toLowerCase();
  const products = (query.data ?? []).filter(
    (product) =>
      (status === 'all' || (status === 'active') === product.isActive) &&
      (!needle || product.title.toLowerCase().includes(needle)),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Products</h2>
          <p className="text-xs text-gray-500">Read-only for now. Editing arrives in Phase 2.</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </QueryState>
      </div>
    </section>
  );
}
