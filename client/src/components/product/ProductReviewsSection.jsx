import { MessageSquare, Star } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import ReviewCard from '@/features/reviews/components/ReviewCard';
import ReviewForm from '@/features/reviews/components/ReviewForm';
import RatingSummary from '@/features/reviews/components/RatingSummary';
import {
  useDeleteReview,
  useMyReviewState,
  useProductReviews,
  useReviewSummary,
} from '@/features/reviews/hooks/useReviews';
import ConfirmDialog from '@/shared/components/ConfirmDialog';

function Skeleton({ rows = 2, label }) {
  return (
    <div role="status" aria-label={label} className="space-y-4 py-4">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/** The customer's own review (any status), with Edit and Delete, or the form to change it. */
function MyReview({ productId, review, onNotice }) {
  const [mode, setMode] = useState('view'); // view | edit | delete
  const [deleteError, setDeleteError] = useState('');
  const remove = useDeleteReview();
  const closeDialog = useCallback(() => {
    setMode('view');
    setDeleteError('');
  }, []);

  if (mode === 'edit') {
    return (
      <ReviewForm
        productId={productId}
        existing={review}
        onCancel={() => setMode('view')}
        onSaved={() => {
          setMode('view');
          onNotice('Thanks! Your changes will appear after approval.');
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4">
      <p className="pt-3 text-[11px] font-black tracking-wider text-blue-700 uppercase">
        Your review
      </p>
      <ReviewCard
        review={review}
        status={review.status}
        actions={
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMode('delete')}
              className="cursor-pointer rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        }
      />
      {review.status === 'pending' && (
        <p className="pb-3 text-[11px] text-gray-500">
          Only you can see this until an admin approves it.
        </p>
      )}
      {mode === 'delete' && (
        <ConfirmDialog
          title="Delete your review?"
          confirmLabel="Delete review"
          danger
          busy={remove.isPending}
          onCancel={closeDialog}
          onConfirm={() =>
            remove.mutate(review.id, {
              onSuccess: () => {
                closeDialog();
                onNotice('Your review was deleted.');
              },
              onError: (error) => setDeleteError(error.message),
            })
          }
        >
          This removes your review and its photos and video. You can write a new one afterwards.
          {deleteError && (
            <span role="alert" className="mt-2 block text-red-600">
              {deleteError}
            </span>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Reviews of one product: the star summary, the customer's own review (or the form, for someone
 * who bought it), and the approved reviews with their photos and videos.
 *
 * @param {{ productId: string }} props
 */
export default function ProductReviewsSection({ productId }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(null);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState('');

  const summary = useReviewSummary(productId);
  const list = useProductReviews(productId, rating);
  const mine = useMyReviewState(productId, user?.id);

  const myReview = mine.data?.review ?? null;
  const eligible = mine.data?.eligible === true;
  // Your own review is shown in its own box, so it is left out of the list below.
  const reviews = (list.data?.pages.flatMap((page) => page.reviews) ?? []).filter(
    (review) => review.id !== myReview?.id,
  );
  const count = summary.data?.count ?? 0;
  const average = summary.data?.average ?? 0;

  const emptyText = rating
    ? `No ${rating}-star reviews yet.`
    : eligible
      ? 'Be the first to review this product'
      : 'No reviews yet.';

  return (
    <section
      aria-label="Customer reviews"
      className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 font-sans shadow-xs"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-xs font-bold tracking-wider text-gray-900 uppercase">
            Customer Reviews ({count})
          </h2>
        </div>
        {count > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="font-bold text-gray-900">{average.toFixed(1)}</span>
            <span className="font-normal text-gray-400">/ 5.0</span>
          </div>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-800"
        >
          {notice}
        </p>
      )}

      {summary.data && (
        <RatingSummary summary={summary.data} selected={rating} onSelect={setRating} />
      )}

      {user?.id && (
        <div className="mt-4 space-y-3">
          {mine.isPending && <Skeleton rows={1} label="Loading your review" />}
          {mine.isError && (
            <p role="alert" className="text-xs text-red-600">
              We couldn&apos;t check whether you can review this product.{' '}
              <button
                type="button"
                onClick={() => mine.refetch()}
                className="cursor-pointer font-bold underline"
              >
                Try again
              </button>
            </p>
          )}
          {myReview && (
            <MyReview
              key={`${myReview.id}-${myReview.status}`}
              productId={productId}
              review={myReview}
              onNotice={setNotice}
            />
          )}
          {eligible && !writing && (
            <button
              type="button"
              onClick={() => {
                setNotice('');
                setWriting(true);
              }}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Write a review
            </button>
          )}
          {eligible && writing && (
            <ReviewForm
              productId={productId}
              onCancel={() => setWriting(false)}
              onSaved={() => {
                setWriting(false);
                setNotice('Thanks! Your review will appear after approval.');
              }}
            />
          )}
        </div>
      )}

      {rating && (
        <p className="mt-4 text-xs text-gray-600">
          Showing {rating}-star reviews.{' '}
          <button
            type="button"
            onClick={() => setRating(null)}
            className="cursor-pointer font-bold text-blue-600 underline"
          >
            Show all
          </button>
        </p>
      )}

      {list.isPending && <Skeleton label="Loading reviews" />}
      {list.isError && (
        <p role="alert" className="py-6 text-center text-xs text-red-600">
          We couldn&apos;t load the reviews.{' '}
          <button
            type="button"
            onClick={() => list.refetch()}
            className="cursor-pointer font-bold underline"
          >
            Try again
          </button>
        </p>
      )}
      {list.isSuccess && reviews.length === 0 && (
        <p className="py-8 text-center text-xs text-gray-400">{emptyText}</p>
      )}
      {reviews.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
            className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            {list.isFetchingNextPage ? 'Loading...' : 'Load more reviews'}
          </button>
        </div>
      )}
    </section>
  );
}
