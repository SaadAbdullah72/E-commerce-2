import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { formatMoney } from '@/shared/lib/formatMoney';

import ConfirmDialog from '../components/ConfirmDialog';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminCoupons } from '../hooks/useAdminData';
import { useSetCouponActive } from '../hooks/useAdminMutations';
import { couponStatus, describeDiscount } from '../lib/couponSchema';

const STATUS = {
  live: { tone: 'green', text: 'Live' },
  scheduled: { tone: 'amber', text: 'Scheduled' },
  expired: { tone: 'gray', text: 'Expired' },
  'used-up': { tone: 'gray', text: 'Used up' },
  paused: { tone: 'gray', text: 'Paused' },
};

const dateText = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null;

function validity(coupon) {
  const from = dateText(coupon.startsAt);
  const to = dateText(coupon.expiresAt);
  if (!from && !to) return 'Always';
  if (from && to) return `${from} to ${to}`;
  return from ? `From ${from}` : `Until ${to}`;
}

export default function CouponsPage() {
  const query = useAdminCoupons();
  const setActive = useSetCouponActive();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? '');

  const needle = search.trim().toUpperCase();
  const now = new Date();
  const coupons = (query.data ?? []).filter(
    (coupon) =>
      (status === 'all' || couponStatus(coupon, now) === status) &&
      (!needle || coupon.code.includes(needle)),
  );

  const confirm = () => {
    const target = pending;
    setActive.mutate(
      { id: target.id, isActive: !target.isActive },
      {
        onSuccess: () => {
          setNotice(`${target.code} was ${target.isActive ? 'paused' : 'resumed'}.`);
          setPending(null);
        },
      },
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Coupons</h2>
          <p className="text-xs text-gray-500">
            Coupons are never deleted, only paused. Customers can use them once checkout is built.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search codes"
            aria-label="Search coupons"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            {Object.entries(STATUS).map(([key, option]) => (
              <option key={key} value={key}>
                {option.text}
              </option>
            ))}
          </select>
          <Link
            to="/admin/coupons/new"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Add coupon
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
          label="coupons"
          isEmpty={coupons.length === 0}
          emptyText={
            query.data?.length ? 'No coupons match your filters.' : 'There are no coupons yet.'
          }
        >
          <table className="w-full min-w-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Discount</th>
                <th className="px-4 py-2 font-semibold">Minimum order</th>
                <th className="px-4 py-2 font-semibold">Valid</th>
                <th className="px-4 py-2 font-semibold">Used</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((coupon) => {
                const badge = STATUS[couponStatus(coupon, now)];
                return (
                  <tr key={coupon.id}>
                    <td className="px-4 py-2 font-mono font-bold text-gray-900">{coupon.code}</td>
                    <td className="px-4 py-2 text-gray-700">{describeDiscount(coupon)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {coupon.minSubtotalMinor > 0 ? formatMoney(coupon.minSubtotalMinor) : 'None'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">{validity(coupon)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {coupon.usedCount} / {coupon.usageLimit ?? 'unlimited'}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/coupons/${coupon.id}`}
                        aria-label={`Edit ${coupon.code}`}
                        className="mr-3 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setActive.reset();
                          setPending(coupon);
                        }}
                        aria-label={`${coupon.isActive ? 'Pause' : 'Resume'} ${coupon.code}`}
                        className={`cursor-pointer text-xs font-bold hover:underline ${
                          coupon.isActive ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        {coupon.isActive ? 'Pause' : 'Resume'}
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
          title={pending.isActive ? 'Pause this coupon?' : 'Resume this coupon?'}
          confirmLabel={pending.isActive ? 'Pause' : 'Resume'}
          danger={pending.isActive}
          busy={setActive.isPending}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        >
          <p>
            <strong className="font-mono">{pending.code}</strong>{' '}
            {pending.isActive
              ? 'will stop working straight away. Nothing is deleted, and you can resume it any time.'
              : 'will work again, within its dates and limits.'}
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
