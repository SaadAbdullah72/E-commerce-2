import { Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Stars } from '@/features/reviews/components/Stars';
import { formatDateTime } from '@/shared/lib/formatDate';

import QueryState from '../components/QueryState';
import { ReviewStatusBadge } from '../components/ReviewBadges';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { REVIEW_STATUS_OPTIONS } from '../lib/reviewStatus';

const selectClass = 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm';

function ReviewRow({ review }) {
  return (
    <li>
      <Link
        to={`/admin/reviews/${review.id}`}
        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50"
      >
        <span className="min-w-0 flex-1 basis-56">
          <span className="block truncate text-sm font-black text-gray-900">
            {review.productTitle}
          </span>
          <span className="block truncate text-xs text-gray-500">
            {review.authorName}
            {review.accountEmail ? ` · ${review.accountEmail}` : ''}
          </span>
          <span className="mt-1 block text-xs text-gray-700">
            {review.title && <b className="font-bold">{review.title}. </b>}
            {review.commentPreview ? (
              <span className="line-clamp-2">{review.commentPreview}</span>
            ) : (
              !review.title && <span className="text-gray-400">(rating only, no text)</span>
            )}
          </span>
        </span>
        <span className="flex items-center gap-4 text-xs">
          <Stars rating={review.rating} />
          <span
            className="inline-flex w-10 items-center gap-1 text-gray-600"
            aria-label={`${review.mediaCount} files`}
          >
            <ImageIcon size={12} aria-hidden="true" /> {review.mediaCount}
          </span>
          <ReviewStatusBadge status={review.status} />
          <time dateTime={review.createdAt} className="w-32 text-right text-gray-500">
            {formatDateTime(review.createdAt)}
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
      <div>
        <h2 className="text-lg font-black text-gray-900">Reviews</h2>
        <p className="text-xs text-gray-500">
          Newest first. Open a review to read it, look at its photos and video, and approve or
          reject it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {REVIEW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          aria-label="Filter by rating"
          className={selectClass}
        >
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((stars) => (
            <option key={stars} value={stars}>
              {stars} {stars === 1 ? 'star' : 'stars'}
            </option>
          ))}
        </select>
        <select
          value={media}
          onChange={(event) => setMedia(event.target.value)}
          aria-label="Filter by photos and video"
          className={selectClass}
        >
          <option value="any">With or without media</option>
          <option value="with">With photos or video</option>
          <option value="without">Without photos or video</option>
        </select>
        <form onSubmit={submitSearch} role="search" className="flex gap-2">
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Product, customer or text"
            aria-label="Search reviews"
            className="w-64 max-w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Search
          </button>
        </form>
        {filtered && (
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer text-sm font-semibold text-blue-600 underline"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs">
        <QueryState
          query={query}
          isEmpty={reviews.length === 0}
          emptyText={
            filtered
              ? 'No reviews match these filters.'
              : 'No reviews are waiting for approval.'
          }
          label="reviews"
        >
          <ul className="divide-y divide-gray-100">
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </ul>
          <div className="border-t border-gray-100 p-3 text-center">
            {query.hasNextPage ? (
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </button>
            ) : (
              <p className="text-xs text-gray-400">End of the list</p>
            )}
            {query.isFetchNextPageError && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                We couldn&apos;t load more reviews. Try again.
              </p>
            )}
          </div>
        </QueryState>
      </div>
    </section>
  );
}
