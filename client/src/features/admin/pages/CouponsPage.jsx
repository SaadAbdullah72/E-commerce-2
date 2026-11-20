import { Pause, Pencil, Play, Plus, Search, Ticket } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { formatMoney } from '@/shared/lib/formatMoney';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { Card } from '@/shared/ui/Card';
import { Input, Select } from '@/shared/ui/Input';
import PageHeader from '@/shared/ui/PageHeader';
import { Td, Th, Tr } from '@/shared/ui/Table';

import CopyCodeButton from '../components/CopyCodeButton';
import CouponStats from '../components/coupons/CouponStats';
import DeleteButton from '../components/DeleteButton';
import DeleteConfirm from '../components/DeleteConfirm';
import IconAction from '../components/IconAction';
import NoticeBanner from '../components/NoticeBanner';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import UsageMeter from '../components/UsageMeter';
import { useAdminCoupons } from '../hooks/useAdminData';
import { useDeleteCoupon, useSetCouponActive } from '../hooks/useAdminMutations';
import { cardTable, cardTableRoles } from '../lib/cardTable';
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
  const remove = useDeleteCoupon();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(null); // the coupon being deleted
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

  const confirmDelete = () => {
    const target = deleting;
    remove.mutate(target.id, {
      onSuccess: () => {
        setNotice(`${target.code} was deleted.`);
        setDeleting(null);
      },
    });
  };

  const addCoupon = (
    <Link to="/admin/coupons/new" className={buttonClass()}>
      <Plus size={16} aria-hidden="true" />
      Add coupon
    </Link>
  );

  return (
    <section className="space-y-4">
      <PageHeader
        title="Coupons"
        description="A used coupon can only be paused; an unused one can be deleted. Customers can use coupons once checkout is built."
        action={addCoupon}
      />

      {query.data?.length > 0 && <CouponStats coupons={query.data} now={now} />}

      <Card className="flex flex-wrap items-center gap-3 !p-3 sm:!p-4">
        <div className="min-w-0 flex-1 basis-64">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search codes"
            aria-label="Search coupons"
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
          {Object.entries(STATUS).map(([key, option]) => (
            <option key={key} value={key}>
              {option.text}
            </option>
          ))}
        </Select>
      </Card>

      {notice && <NoticeBanner onDismiss={() => setNotice('')}>{notice}</NoticeBanner>}

      <Card flush className="relative overflow-x-auto">
        <QueryState
          query={query}
          label="coupons"
          isEmpty={coupons.length === 0}
          emptyIcon={Ticket}
          emptyText={
            query.data?.length ? 'No coupons match your filters.' : 'There are no coupons yet.'
          }
          emptyAction={query.data?.length ? undefined : addCoupon}
        >
          <table
            className={`w-full min-w-200 text-left text-sm ${cardTable.table}`}
            {...cardTableRoles.table}
          >
            <caption className="sr-only">Coupons</caption>
            <thead className={`bg-gray-50 ${cardTable.head}`} {...cardTableRoles.head}>
              <tr {...cardTableRoles.row}>
                <Th {...cardTableRoles.header}>Code</Th>
                <Th {...cardTableRoles.header}>Discount</Th>
                <Th {...cardTableRoles.header}>Minimum order</Th>
                <Th {...cardTableRoles.header}>Valid</Th>
                <Th {...cardTableRoles.header}>Used</Th>
                <Th {...cardTableRoles.header}>Status</Th>
                <Th {...cardTableRoles.header}>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody className={cardTable.body} {...cardTableRoles.body}>
              {coupons.map((coupon) => {
                const badge = STATUS[couponStatus(coupon, now)];
                return (
                  <Tr key={coupon.id} className={cardTable.row} {...cardTableRoles.row}>
                    <Td className={cardTable.titleCell} {...cardTableRoles.cell}>
                      <div className="flex items-center gap-1">
                        <span className="rounded-md bg-gray-100 px-2 py-1 font-mono font-bold text-gray-900">
                          {coupon.code}
                        </span>
                        <CopyCodeButton code={coupon.code} />
                      </div>
                    </Td>
                    <Td className={cardTable.cell} data-label="Discount" {...cardTableRoles.cell}>
                      {describeDiscount(coupon)}
                    </Td>
                    <Td
                      className={`text-gray-600 ${cardTable.cell}`}
                      data-label="Minimum order"
                      {...cardTableRoles.cell}
                    >
                      {coupon.minSubtotalMinor > 0 ? formatMoney(coupon.minSubtotalMinor) : 'None'}
                    </Td>
                    <Td
                      className={`text-xs text-gray-600 md:whitespace-nowrap ${cardTable.cell}`}
                      data-label="Valid"
                      {...cardTableRoles.cell}
                    >
                      {validity(coupon)}
                    </Td>
                    <Td className={cardTable.cell} data-label="Used" {...cardTableRoles.cell}>
                      <UsageMeter used={coupon.usedCount} limit={coupon.usageLimit} />
                    </Td>
                    <Td className={cardTable.cell} data-label="Status" {...cardTableRoles.cell}>
                      <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                    </Td>
                    <Td
                      align="right"
                      className={`whitespace-nowrap ${cardTable.actionsCell}`}
                      {...cardTableRoles.cell}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <IconAction
                          to={`/admin/coupons/${coupon.id}`}
                          label={`Edit ${coupon.code}`}
                          tip="Edit"
                          icon={Pencil}
                          tone="blue"
                        />
                        <IconAction
                          onClick={() => {
                            setActive.reset();
                            setPending(coupon);
                          }}
                          label={`${coupon.isActive ? 'Pause' : 'Resume'} ${coupon.code}`}
                          tip={coupon.isActive ? 'Pause' : 'Resume'}
                          icon={coupon.isActive ? Pause : Play}
                          tone={coupon.isActive ? 'red' : 'green'}
                        />
                        <DeleteButton
                          label={coupon.code}
                          disabledReason={
                            coupon.usedCount > 0
                              ? 'Used coupons cannot be deleted. Pause it instead.'
                              : ''
                          }
                          onClick={() => {
                            remove.reset();
                            setDeleting(coupon);
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

      {deleting && (
        <DeleteConfirm
          name={deleting.code}
          kind="coupon"
          busy={remove.isPending}
          error={remove.isError ? remove.error.message : ''}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
