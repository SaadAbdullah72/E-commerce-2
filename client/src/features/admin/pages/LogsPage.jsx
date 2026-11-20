import { ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import { useState } from 'react';

import { focusRing } from '@/shared/design/tokens';
import Button from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Input, Select } from '@/shared/ui/Input';
import PageHeader from '@/shared/ui/PageHeader';

import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAuditLog } from '../hooks/useAdminData';
import {
  ACTION_LABELS,
  ACTION_TONES,
  actorLabel,
  describeChanges,
  TABLE_LABELS,
} from '../lib/auditFormat';
import { AUDIT_ACTIONS, AUDIT_TABLES } from '../services/auditLogService';

const timeText = (iso) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function ChangeDetails({ entry }) {
  const { kind, rows } = describeChanges(entry);

  if (kind === 'none') {
    return (
      <p className="text-xs text-gray-600">
        No field-level details were recorded for this {ACTION_LABELS[entry.action].toLowerCase()}{' '}
        entry.
      </p>
    );
  }

  if (kind === 'diff') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-gray-600">
              <th scope="col" className="py-1 pr-4 font-semibold">
                Field
              </th>
              <th scope="col" className="py-1 pr-4 font-semibold">
                Before
              </th>
              <th scope="col" className="py-1 font-semibold">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className="border-t border-gray-100 align-top">
                <th
                  scope="row"
                  className="py-1.5 pr-4 font-semibold whitespace-nowrap text-gray-700"
                >
                  {row.label}
                </th>
                <td className="py-1.5 pr-4 break-words text-red-700">{row.from}</td>
                <td className="py-1.5 break-words text-green-700">{row.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-xs font-semibold text-gray-600">The record as it was</p>
      <table className="w-full text-left text-xs">
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} className="border-t border-gray-100 align-top">
              <th scope="row" className="py-1.5 pr-4 font-semibold whitespace-nowrap text-gray-700">
                {row.label}
              </th>
              <td className="py-1.5 break-words text-gray-700">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogEntry({ entry, open, onToggle }) {
  const panelId = `log-details-${entry.id}`;
  return (
    <li className="px-4 py-3 transition-colors duration-150 hover:bg-gray-50/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full cursor-pointer items-start gap-2 rounded-lg text-left max-md:min-h-11 ${focusRing}`}
      >
        {open ? (
          <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold break-words text-gray-900">
            {entry.summary}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
            <StatusBadge tone={ACTION_TONES[entry.action]}>
              {ACTION_LABELS[entry.action]}
            </StatusBadge>
            <span>{TABLE_LABELS[entry.table] ?? entry.table}</span>
            <span title={entry.actorEmail ? undefined : 'Changed directly in the database'}>
              {actorLabel(entry)}
            </span>
            <time dateTime={entry.at}>{timeText(entry.at)}</time>
          </span>
        </span>
      </button>
      {open && (
        <div id={panelId} className="mt-3 ml-6 rounded-lg bg-gray-50 p-3">
          <ChangeDetails entry={entry} />
        </div>
      )}
    </li>
  );
}

export default function LogsPage() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [openIds, setOpenIds] = useState(() => new Set());

  const query = useAuditLog({ table, action, search });
  const entries = query.data?.pages.flatMap((page) => page.entries) ?? [];
  const filtered = Boolean(table || action || search);

  const toggle = (id) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(draft.trim());
  };

  const clearFilters = () => {
    setTable('');
    setAction('');
    setDraft('');
    setSearch('');
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Activity log"
        description="Every change to products, categories, deal tags, coupons, banners, admin roles and orders (shipping and tracking). The log is read-only: nobody can edit or delete it."
      />

      <Card className="flex flex-wrap items-center gap-3 !p-3 sm:!p-4">
        <Select
          value={table}
          onChange={(event) => setTable(event.target.value)}
          aria-label="Filter by area"
          className="!w-auto"
        >
          <option value="">All areas</option>
          {AUDIT_TABLES.map((name) => (
            <option key={name} value={name}>
              {TABLE_LABELS[name]}
            </option>
          ))}
        </Select>
        <Select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          aria-label="Filter by action"
          className="!w-auto"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((name) => (
            <option key={name} value={name}>
              {ACTION_LABELS[name]}
            </option>
          ))}
        </Select>
        <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 basis-64 gap-2">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search summary or admin email"
              aria-label="Search the log"
              leadingIcon={<Search size={16} />}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className={`cursor-pointer rounded px-1 text-sm font-semibold text-blue-700 underline hover:text-blue-800 max-md:min-h-11 ${focusRing}`}
          >
            Clear filters
          </button>
        )}
      </Card>

      <Card flush>
        <QueryState
          query={query}
          isEmpty={entries.length === 0}
          emptyText={
            filtered ? 'No log entries match these filters.' : 'No changes have been logged yet.'
          }
          emptyIcon={History}
          label="activity log"
        >
          <ul className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <LogEntry
                key={entry.id}
                entry={entry}
                open={openIds.has(entry.id)}
                onToggle={() => toggle(entry.id)}
              />
            ))}
          </ul>
          <div className="border-t border-gray-100 p-3 text-center">
            {query.hasNextPage ? (
              <Button
                variant="secondary"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            ) : (
              <p className="text-xs text-gray-500">End of the log</p>
            )}
            {query.isFetchNextPageError && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                We couldn&apos;t load more entries. Try again.
              </p>
            )}
          </div>
        </QueryState>
      </Card>
    </section>
  );
}
