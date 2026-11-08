import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import BannerPreview from '../components/BannerPreview';
import ConfirmDialog from '../components/ConfirmDialog';
import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminBanners } from '../hooks/useAdminData';
import { useSetBannerActive, useSwapBannerOrder } from '../hooks/useAdminMutations';
import { MAX_ACTIVE_BANNERS } from '../lib/bannerSchema';

const KINDS = [
  { key: 'hero', label: 'Hero slides', singular: 'hero slide', addLabel: 'Add slide' },
  {
    key: 'announcement',
    label: 'Announcements',
    singular: 'announcement',
    addLabel: 'Add announcement',
  },
];

function bannerStatus(banner, now) {
  if (!banner.isActive) return { tone: 'gray', text: 'Paused' };
  if (banner.startsAt && new Date(banner.startsAt) > now)
    return { tone: 'amber', text: 'Scheduled' };
  if (banner.endsAt && new Date(banner.endsAt) <= now) return { tone: 'gray', text: 'Ended' };
  return { tone: 'green', text: 'Live' };
}

function BannerList({ kind, onNotice }) {
  const query = useAdminBanners(kind.key);
  const setActive = useSetBannerActive();
  const swap = useSwapBannerOrder();
  const [pending, setPending] = useState(null);

  const banners = query.data ?? [];
  const activeCount = banners.filter((banner) => banner.isActive).length;
  const limit = MAX_ACTIVE_BANNERS[kind.key];
  const now = new Date();

  const confirm = () => {
    const target = pending;
    setActive.mutate(
      { id: target.id, isActive: !target.isActive },
      {
        onSuccess: () => {
          onNotice(`"${target.title}" was ${target.isActive ? 'paused' : 'resumed'}.`);
          setPending(null);
        },
      },
    );
  };

  const move = (index, direction) => {
    const first = banners[index];
    const second = banners[index + direction];
    if (!first || !second) return;
    // Equal positions cannot be swapped, so give the pair distinct numbers first.
    const firstOrder = first.sortOrder;
    const secondOrder =
      first.sortOrder === second.sortOrder ? second.sortOrder + direction : second.sortOrder;
    swap.mutate({
      first: { id: first.id, sortOrder: firstOrder },
      second: { id: second.id, sortOrder: secondOrder },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {activeCount} of {limit} active. Nothing is deleted, only paused.
        </p>
        <Link
          to={`/admin/banners/new?kind=${kind.key}`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          {kind.addLabel}
        </Link>
      </div>

      {swap.isError && (
        <p role="alert" className="text-sm text-red-600">
          {swap.error.message}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs">
        <QueryState
          query={query}
          label={kind.label.toLowerCase()}
          isEmpty={banners.length === 0}
          emptyText={`There are no ${kind.label.toLowerCase()} yet. Nothing is shown in the shop for this.`}
        >
          <ul className="divide-y divide-gray-100">
            {banners.map((banner, index) => {
              const badge = bannerStatus(banner, now);
              return (
                <li key={banner.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <BannerPreview
                      kind={kind.key}
                      title={banner.title}
                      badge={banner.badge}
                      subtitle={banner.subtitle}
                      buttonText={banner.buttonText}
                      theme={banner.theme}
                      imageUrl={banner.imageUrl}
                    />
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${banner.title} up`}
                        disabled={index === 0 || swap.isPending}
                        onClick={() => move(index, -1)}
                        className="cursor-pointer rounded border border-gray-200 p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${banner.title} down`}
                        disabled={index === banners.length - 1 || swap.isPending}
                        onClick={() => move(index, 1)}
                        className="cursor-pointer rounded border border-gray-200 p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </span>
                    <Link
                      to={`/admin/banners/${banner.id}`}
                      aria-label={`Edit ${banner.title}`}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setActive.reset();
                        setPending(banner);
                      }}
                      aria-label={`${banner.isActive ? 'Pause' : 'Resume'} ${banner.title}`}
                      className={`cursor-pointer text-xs font-bold hover:underline ${
                        banner.isActive ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {banner.isActive ? 'Pause' : 'Resume'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </QueryState>
      </div>

      {pending && (
        <ConfirmDialog
          title={
            pending.isActive ? `Pause this ${kind.singular}?` : `Resume this ${kind.singular}?`
          }
          confirmLabel={pending.isActive ? 'Pause' : 'Resume'}
          danger={pending.isActive}
          busy={setActive.isPending}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        >
          <p>
            <strong>{pending.title}</strong>{' '}
            {pending.isActive
              ? 'will disappear from the shop. Nothing is deleted, and you can resume it any time.'
              : 'will appear in the shop again, within its schedule.'}
          </p>
          {setActive.isError && (
            <p role="alert" className="mt-2 text-red-600">
              {setActive.error.message}
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function BannersPage() {
  const location = useLocation();
  const [kindKey, setKindKey] = useState(location.state?.kind ?? 'hero');
  const [notice, setNotice] = useState(location.state?.notice ?? '');
  const kind = KINDS.find((item) => item.key === kindKey) ?? KINDS[0];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">Banners</h2>
        <p className="text-xs text-gray-500">
          What visitors see at the top of the shop. Changes appear within a minute.
        </p>
      </div>

      <div role="tablist" aria-label="Banner type" className="flex gap-1 border-b border-gray-200">
        {KINDS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === kind.key}
            onClick={() => setKindKey(item.key)}
            className={`cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold ${
              item.key === kind.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
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

      <BannerList key={kind.key} kind={kind} onNotice={setNotice} />
    </section>
  );
}
