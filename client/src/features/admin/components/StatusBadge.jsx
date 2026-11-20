import Badge from '@/shared/ui/Badge';

/**
 * A status pill. `indigo` is the old name for purple (shipped orders), kept so callers do not change.
 *
 * @param {{ tone?: 'blue' | 'indigo' | 'purple' | 'green' | 'amber' | 'red' | 'gray', children: import('react').ReactNode }} props
 */
export default function StatusBadge({ tone = 'gray', children }) {
  return (
    <Badge tone={tone === 'indigo' ? 'purple' : tone} size="sm">
      {children}
    </Badge>
  );
}
