import { type } from '@/shared/design/tokens';

/**
 * The top of a page: title, a line of explanation, and the main action on the right.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.action] usually one primary Button
 * @param {'h1' | 'h2'} [props.as] heading level of the title
 */
export default function PageHeader({ title, description, action, as: Heading = 'h2' }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Heading className={type.h1}>{title}</Heading>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
