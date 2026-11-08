import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import CouponForm from '../components/CouponForm';
import QueryState from '../components/QueryState';
import { useAdminCoupon } from '../hooks/useAdminData';
import { useSaveCoupon } from '../hooks/useAdminMutations';

/** Add (/admin/coupons/new) and edit (/admin/coupons/:id) share this page. */
export default function CouponEditPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const coupon = useAdminCoupon(isNew ? null : id);
  const save = useSaveCoupon();

  const notFound = !isNew && coupon.isSuccess && coupon.data === null;

  const handleSubmit = (row) =>
    save.mutate(
      { id: isNew ? null : id, row },
      {
        onSuccess: () =>
          navigate('/admin/coupons', {
            state: { notice: isNew ? 'Coupon added.' : 'Coupon saved.' },
          }),
      },
    );

  return (
    <section className="space-y-4">
      <div>
        <Link
          to="/admin/coupons"
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to coupons
        </Link>
        <h2 className="text-lg font-black text-gray-900">{isNew ? 'Add coupon' : 'Edit coupon'}</h2>
      </div>

      {notFound ? (
        <p
          role="alert"
          className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600"
        >
          This coupon does not exist.
        </p>
      ) : (
        <QueryState
          query={isNew ? { isPending: false, isError: false, refetch: () => {} } : coupon}
          label="coupon"
          isEmpty={false}
          emptyText=""
        >
          <CouponForm
            key={isNew ? 'new' : id}
            initialValues={isNew ? undefined : coupon.data?.values}
            usedCount={isNew ? 0 : (coupon.data?.usedCount ?? 0)}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/admin/coupons')}
            isSaving={save.isPending}
            serverError={save.error?.message ?? ''}
          />
        </QueryState>
      )}
    </section>
  );
}
