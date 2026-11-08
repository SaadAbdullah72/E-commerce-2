import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import ProductForm from '../components/ProductForm';
import QueryState from '../components/QueryState';
import { useAdminCategories, useAdminDealTags, useAdminProduct } from '../hooks/useAdminData';
import { useSaveProduct } from '../hooks/useAdminMutations';

/** Add (/admin/products/new) and edit (/admin/products/:id) share this page. */
export default function ProductEditPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();

  const product = useAdminProduct(isNew ? null : id);
  const categories = useAdminCategories();
  const dealTags = useAdminDealTags();
  const save = useSaveProduct();

  const loading = [categories, dealTags, ...(isNew ? [] : [product])];
  const loadState = {
    isPending: loading.some((query) => query.isPending),
    isError: loading.some((query) => query.isError),
    refetch: () => loading.forEach((query) => query.isError && query.refetch()),
  };
  const notFound = !isNew && product.isSuccess && product.data === null;

  const handleSubmit = (payload) => {
    save.mutate(
      { id: isNew ? null : id, payload },
      {
        onSuccess: () =>
          navigate('/admin/products', {
            state: { notice: isNew ? 'Product added.' : 'Product saved.' },
          }),
      },
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <Link
          to="/admin/products"
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to products
        </Link>
        <h2 className="text-lg font-black text-gray-900">
          {isNew ? 'Add product' : 'Edit product'}
        </h2>
      </div>

      {notFound ? (
        <p
          role="alert"
          className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600"
        >
          This product does not exist.
        </p>
      ) : (
        <QueryState query={loadState} label="product form" isEmpty={false} emptyText="">
          <ProductForm
            key={isNew ? 'new' : id}
            initialValues={isNew ? undefined : product.data}
            categories={categories.data ?? []}
            dealTags={dealTags.data ?? []}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/admin/products')}
            isSaving={save.isPending}
            serverError={save.error?.message ?? ''}
          />
        </QueryState>
      )}
    </section>
  );
}
