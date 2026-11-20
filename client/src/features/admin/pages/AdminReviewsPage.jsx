import { Image as ImageIcon, MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Stars } from '@/features/reviews/components/Stars';
import { focusRing } from '@/shared/design/tokens';
import { formatDateTime, formatRelative } from '@/shared/lib/formatDate';
import Button from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Input, Select } from '@/shared/ui/Input';
import PageHeader from '@/shared/ui/PageHeader';

import QueryState from '../components/QueryState';
import { ReviewStatusBadge } from '../components/ReviewBadges';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { REVIEW_STATUS_OPTIONS } from '../lib/reviewStatus';

function ReviewRow({ review }) {
  return (
    <li>
      <Link
        to={`/admin/reviews/${review.id}`}
        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <span className="min-w-0 flex-1 basis-56">
          <span className="block truncate text-sm font-bold text-gray-900">
            {review.productTitle}
          </span>
          <span className="block truncate text-xs text-gray-600">
            {review.authorName}
            {review.accountEmail ? ` · ${review.accountEmail}` : ''}
          </span>
          <span className="mt-1 block text-xs text-gray-700">
            {review.title && <b className="font-bold">{review.title}. </b>}
            {review.commentPreview ? (
              <span className="line-clamp-2">{review.commentPreview}</span>
            ) : (
              !review.title && <span className="text-gray-500">(rating only, no text)</span>
            )}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Stars rating={review.rating} />
          <span
            className="inline-flex w-10 items-center gap-1 text-gray-700"
            aria-label={`${review.mediaCount} files`}
          >
            <ImageIcon size={12} aria-hidden="true" /> {review.mediaCount}
          </span>
          <ReviewStatusBadge status={review.status} />
          <time
            dateTime={review.createdAt}
            title={formatDateTime(review.createdAt)}
            className="text-gray-600 sm:w-28 sm:text-right"
          >
            {formatRelative(review.createdAt)}
          </time>
        </span>
      </Link>
    </li>
  );
}

const MEDIA_FILTERS = { any: null, with: true, without: false };

/** The moderation queue. Starts on "Pending" so the work to do comes first. */
export default function AdminReviewsPage() {
  const [status, setStatus] = useState('pending');
  const [rating, setRating] = useState('');
  const [media, setMedia] = useState('any');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  const query = useAdminReviews({
    status,
    rating: rating ? Number(rating) : null,
    hasMedia: MEDIA_FILTERS[media],
    search,
  });
  const reviews = query.data?.pages.flatMap((page) => page.reviews) ?? [];
  const filtered = Boolean(status !== 'pending' || rating || media !== 'any' || search);

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(draft.trim());
  };
  const reset = () => {
    setStatus('pending');
    setRating('');
    setMedia('any');
    setDraft('');
    setSearch('');
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Reviews"
        description="Newest first. Open a review to read it, look at its photos and video, and approve or reject it."
      />

      <Card className="flex flex-wrap items-center gap-3 !p-3 sm:!p-4">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="!w-auto"
        >
          <option value="">All statuses</option>
          {REVIEW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          aria-label="Filter by rating"
          className="!w-auto"
        >
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((stars) => (
            <option key={stars} value={stars}>
              {stars} {stars === 1 ? 'star' : 'stars'}
            </option>
          ))}
        </Select>
        <Select
          value={media}
          onChange={(event) => setMedia(event.target.value)}
          aria-label="Filter by photos and video"
          className="!w-auto"
        >
          <option value="any">With or without media</option>
          <option value="with">With photos or video</option>
          <option value="without">Without photos or video</option>
        </Select>
        <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 basis-64 gap-2">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Product, customer or text"
              aria-label="Search reviews"
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
            onClick={reset}
            className={`cursor-pointer rounded px-1 text-sm font-semibold text-blue-700 underline hover:text-blue-800 max-md:min-h-11 ${focusRing}`}
          >
            Reset filters
          </button>
        )}
      </Card>

      <Card flush>
        <QueryState
          query={query}
          isEmpty={reviews.length === 0}
          emptyText={
            filtered
              ? 'No reviews match these filters.'
              : 'No reviews are waiting for approval.'
          }
          emptyIcon={MessageSquare}
          label="reviews"
        >
          <ul className="divide-y divide-gray-100">
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
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
              <p className="text-xs text-gray-500">End of the list</p>
            )}
            {query.isFetchNextPageError && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                We couldn&apos;t load more reviews. Try again.
              </p>
            )}
          </div>
        </QueryState>
      </Card>
    </section>
  );
}
