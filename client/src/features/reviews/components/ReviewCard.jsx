import { BadgeCheck } from 'lucide-react';

import { formatDate } from '@/shared/lib/formatDate';

import MediaGrid from './MediaGrid';
import { Stars } from './Stars';

const STATUS_NOTE = {
  pending: { text: 'Awaiting approval', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  rejected: { text: 'Not approved', className: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * One review. The text is shown as plain text (line breaks kept), never as markup.
 *
 * @param {{ review: { id: string, rating: number, title?: string | null, comment?: string | null,
 *   authorName: string, verified?: boolean, createdAt: string, media: any[] },
 *   status?: 'pending' | 'approved' | 'rejected', actions?: import('react').ReactNode }} props
 */
export default function ReviewCard({ review, status, actions }) {
  const note = STATUS_NOTE[status];
  return (
    <article className="py-4 first:pt-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-900">
          {review.authorName}
          {review.verified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
              <BadgeCheck size={11} aria-hidden="true" /> Verified Purchase
            </span>
          )}
          {note && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${note.className}`}
            >
              {note.text}
            </span>
          )}
        </span>
        <time dateTime={review.createdAt} className="text-[10px] text-gray-400">
          {formatDate(review.createdAt)}
        </time>
      </div>
      <div className="mb-1.5">
        <Stars rating={review.rating} />
      </div>
      {review.title && <h3 className="mb-1 text-xs font-bold text-gray-900">{review.title}</h3>}
      {review.comment && (
        <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{review.comment}</p>
      )}
      <MediaGrid media={review.media} />
      {actions}
    </article>
  );
}
