import { Ban, Folder, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import ConfirmDialog from '@/shared/components/ConfirmDialog';
import Button from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import PageHeader from '@/shared/ui/PageHeader';
import { Td, Th, Tr } from '@/shared/ui/Table';

import CategoryForm from '../components/CategoryForm';
import DeleteButton from '../components/DeleteButton';
import DeleteConfirm from '../components/DeleteConfirm';
import IconAction from '../components/IconAction';
import NoticeBanner from '../components/NoticeBanner';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminCategories, useAdminCategory } from '../hooks/useAdminData';
import {
  useDeleteCategory,
  useSaveCategory,
  useSetCategoryActive,
} from '../hooks/useAdminMutations';
import { cardTable, cardTableRoles } from '../lib/cardTable';
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
  const remove = useDeleteCategory();
  const [dialog, setDialog] = useState(null); // null | { id: string | null }
  const [pending, setPending] = useState(null); // { category, liveProducts }
  const [deleting, setDeleting] = useState(null); // the category being deleted
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

  const confirmDelete = () => {
    const target = deleting;
    remove.mutate(target.id, {
      onSuccess: () => {
        setNotice(`"${target.name}" was deleted.`);
        setDeleting(null);
      },
    });
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Categories"
        description="Deactivated categories are hidden from the shop. A category can only be deleted when it has no products."
        action={
          <Button onClick={() => setDialog({ id: null })}>
            <Plus size={16} aria-hidden="true" />
            Add category
          </Button>
        }
      />

      {notice && <NoticeBanner onDismiss={() => setNotice('')}>{notice}</NoticeBanner>}

      <Card flush className="relative overflow-x-auto">
        <QueryState
          query={query}
          label="categories"
          isEmpty={query.data?.length === 0}
          emptyIcon={Folder}
          emptyText="There are no categories yet."
        >
          <table
            className={`w-full min-w-96 text-left text-sm ${cardTable.table}`}
            {...cardTableRoles.table}
          >
            <caption className="sr-only">Categories</caption>
            <thead className={`bg-gray-50 ${cardTable.head}`} {...cardTableRoles.head}>
              <tr {...cardTableRoles.row}>
                <Th {...cardTableRoles.header}>Name</Th>
                <Th {...cardTableRoles.header}>Slug</Th>
                <Th {...cardTableRoles.header}>Order</Th>
                <Th {...cardTableRoles.header}>Status</Th>
                <Th {...cardTableRoles.header}>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody className={cardTable.body} {...cardTableRoles.body}>
              {query.data?.map((category) => (
                <Tr key={category.id} className={cardTable.row} {...cardTableRoles.row}>
                  <Td
                    className={`font-semibold text-gray-900 ${cardTable.titleCell}`}
                    {...cardTableRoles.cell}
                  >
                    {category.name}
                  </Td>
                  <Td
                    className={`text-gray-600 ${cardTable.cell}`}
                    data-label="Slug"
                    {...cardTableRoles.cell}
                  >
                    {category.slug}
                  </Td>
                  <Td
                    numeric
                    className={`text-gray-600 ${cardTable.cell}`}
                    data-label="Order"
                    {...cardTableRoles.cell}
                  >
                    {category.sortOrder}
                  </Td>
                  <Td className={cardTable.cell} data-label="Status" {...cardTableRoles.cell}>
                    <StatusBadge tone={category.isActive ? 'green' : 'gray'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </Td>
                  <Td
                    align="right"
                    className={`whitespace-nowrap ${cardTable.actionsCell}`}
                    {...cardTableRoles.cell}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        onClick={() => setDialog({ id: category.id })}
                        label={`Edit ${category.name}`}
                        tip="Edit"
                        icon={Pencil}
                        tone="blue"
                      />
                      <IconAction
                        onClick={() => askToToggle(category)}
                        label={`${category.isActive ? 'Deactivate' : 'Restore'} ${category.name}`}
                        tip={category.isActive ? 'Deactivate' : 'Restore'}
                        icon={category.isActive ? Ban : RotateCcw}
                        tone={category.isActive ? 'red' : 'green'}
                      />
                      <DeleteButton
                        label={category.name}
                        onClick={() => {
                          remove.reset();
                          setDeleting(category);
                        }}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

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

      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          kind="category"
          busy={remove.isPending}
          error={remove.isError ? remove.error.message : ''}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
