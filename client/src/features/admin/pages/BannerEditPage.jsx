import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import BannerForm from '../components/BannerForm';
import QueryState from '../components/QueryState';
import { useAdminBanner } from '../hooks/useAdminData';
import { useSaveBanner } from '../hooks/useAdminMutations';

/** Add (/admin/banners/new?kind=hero|announcement) and edit (/admin/banners/:id). */
export default function BannerEditPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const banner = useAdminBanner(isNew ? null : id);
  const save = useSaveBanner();

  const kind = isNew
    ? search.get('kind') === 'announcement'
      ? 'announcement'
      : 'hero'
    : banner.data?.kind;
  const notFound = !isNew && banner.isSuccess && banner.data === null;

  const handleSubmit = (row) =>
    save.mutate(
      { id: isNew ? null : id, row },
      {
        onSuccess: () =>
          navigate('/admin/banners', {
            state: { notice: isNew ? 'Banner added.' : 'Banner saved.', kind: row.kind },
          }),
      },
    );

  return (
    <section className="space-y-4">
      <div>
        <Link
          to="/admin/banners"
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to banners
        </Link>
        <h2 className="text-lg font-black text-gray-900">
          {isNew ? 'Add' : 'Edit'} {kind === 'announcement' ? 'announcement' : 'hero slide'}
        </h2>
      </div>

      {notFound ? (
        <p
          role="alert"
          className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600"
        >
          This banner does not exist.
        </p>
      ) : (
        <QueryState
          query={isNew ? { isPending: false, isError: false, refetch: () => {} } : banner}
          label="banner"
          isEmpty={false}
          emptyText=""
        >
          <BannerForm
            key={isNew ? `new-${kind}` : id}
            kind={kind}
            initialValues={isNew ? undefined : banner.data?.values}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/admin/banners')}
            isSaving={save.isPending}
            serverError={save.error?.message ?? ''}
          />
        </QueryState>
      )}
    </section>
  );
}
