import EmptyState from '@/shared/ui/EmptyState';
import ErrorState from '@/shared/ui/ErrorState';
import TableSkeleton from '@/shared/ui/TableSkeleton';

/**
 * Shared loading / error / empty states for admin lists.
 *
 * @param {object} props
 * @param {{ isPending: boolean, isError: boolean, refetch: () => void }} props.query
 * @param {boolean} props.isEmpty
 * @param {string} props.emptyText
 * @param {string} props.label what is loading, for screen readers
 * @param {import('react').ComponentType} [props.emptyIcon] a lucide icon for the empty state
 * @param {import('react').ReactNode} [props.emptyAction] a button or link for the empty state
 * @param {import('react').ReactNode} [props.skeleton] what to show while loading, when it should look like the final page (default: table rows)
 * @param {import('react').ReactNode} props.children shown when there is data
 */
export default function QueryState({
  query,
  isEmpty,
  emptyText,
  label,
  emptyIcon,
  emptyAction,
  skeleton,
  children,
}) {
  if (query.isPending) return skeleton ?? <TableSkeleton label={label} />;
  if (query.isError) {
    return (
      <ErrorState message={`We couldn't load the ${label}.`} onRetry={() => query.refetch()} />
    );
  }
  if (isEmpty) return <EmptyState message={emptyText} icon={emptyIcon} action={emptyAction} />;
  return children;
}
