import { useState } from 'react';

import CategoryForm from '../components/CategoryForm';
import ConfirmDialog from '../components/ConfirmDialog';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminCategories, useAdminCategory } from '../hooks/useAdminData';
import { useSaveCategory, useSetCategoryActive } from '../hooks/useAdminMutations';
import { countActiveProductsInCategory } from '../services/categoryAdminService';

/** The add / edit dialog. For an existing category it loads the full record first. */
function CategoryDialog({ id, onClose, onSaved }) {
  const isNew = id === null;
  const existing = useAdminCategory(isNew ? null : id);
  const save = useSaveCategory();

  const handleSubmit = (row) =>
    save.mutate(
      { id, row },
      { onSuccess: () => onSaved(isNew ? 'Category added.' : 'Category saved.') },
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Add category' : 'Edit category'}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="mb-4 text-base font-black text-gray-900">
          {isNew ? 'Add category' : 'Edit category'}
        </h2>
        {isNew ? (
          <CategoryForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isSaving={save.isPending}
            serverError={save.error?.message ?? ''}
          />
        ) : (
          <QueryState
            query={existing}
            label="category"
            isEmpty={existing.data === null}
            emptyText="This category does not exist."
          >
            <CategoryForm
              initialValues={existing.data}
              onSubmit={handleSubmit}
              onCancel={onClose}
              isSaving={save.isPending}
              serverError={save.error?.message ?? ''}
            />
          </QueryState>
        )}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const query = useAdminCategories();
  const setActive = useSetCategoryActive();
  const [dialog, setDialog] = useState(null); // null | { id: string | null }
  const [pending, setPending] = useState(null); // { category, liveProducts }
  const [notice, setNotice] = useState('');

  const askToToggle = async (category) => {
    setActive.reset();
    const liveProducts = category.isActive ? await countActiveProductsInCategory(category.id) : 0;
    setPending({ category, liveProducts });
  };

  const confirm = () => {
    const { category } = pending;
    setActive.mutate(
      { id: category.id, isActive: !category.isActive },
      {
        onSuccess: () => {
          setNotice(
            category.isActive
              ? `"${category.name}" was deactivated.`
              : `"${category.name}" was restored.`,
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
          <h2 className="text-lg font-black text-gray-900">Categories</h2>
          <p className="text-xs text-gray-500">
            Deactivated categories are hidden from the shop but never deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ id: null })}
          className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          Add category
        </button>
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
          label="categories"
          isEmpty={query.data?.length === 0}
          emptyText="There are no categories yet."
        >
          <table className="w-full min-w-96 text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Slug</th>
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {query.data?.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-2 font-semibold text-gray-900">{category.name}</td>
                  <td className="px-4 py-2 text-gray-600">{category.slug}</td>
                  <td className="px-4 py-2 text-gray-600">{category.sortOrder}</td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={category.isActive ? 'green' : 'gray'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setDialog({ id: category.id })}
                      aria-label={`Edit ${category.name}`}
                      className="mr-3 cursor-pointer text-xs font-bold text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => askToToggle(category)}
                      aria-label={`${category.isActive ? 'Deactivate' : 'Restore'} ${category.name}`}
                      className={`cursor-pointer text-xs font-bold hover:underline ${
                        category.isActive ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {category.isActive ? 'Deactivate' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </div>

      {dialog && (
        <CategoryDialog
          key={dialog.id ?? 'new'}
          id={dialog.id}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setNotice(message);
            setDialog(null);
          }}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={pending.category.isActive ? 'Deactivate this category?' : 'Restore this category?'}
          confirmLabel={pending.category.isActive ? 'Deactivate' : 'Restore'}
          danger={pending.category.isActive}
          busy={setActive.isPending}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        >
          <p>
            <strong>{pending.category.name}</strong>{' '}
            {pending.category.isActive
              ? 'will be hidden from the shop. Nothing is deleted, and you can restore it any time.'
              : 'will appear in the shop again.'}
          </p>
          {pending.category.isActive && pending.liveProducts > 0 && (
            <p className="mt-2 font-semibold text-amber-700">
              {pending.liveProducts} active product{pending.liveProducts === 1 ? ' is' : 's are'} in
              this category and may not be easy to find while it is hidden.
            </p>
          )}
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
