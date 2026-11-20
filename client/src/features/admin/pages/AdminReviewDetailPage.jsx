import { ArrowLeft } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Stars } from '@/features/reviews/components/Stars';
import { formatDuration, largeUrl, thumbnailUrl } from '@/features/reviews/lib/mediaUrls';
import { formatBytes } from '@/features/reviews/lib/reviewRules';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { focusRing } from '@/shared/design/tokens';
import { formatDateTime } from '@/shared/lib/formatDate';

import { isUuid } from '../../checkout/services/checkoutService';
import { ReviewStatusBadge } from '../components/ReviewBadges';
import {
  useAdminReview,
  useDeleteReviewAsAdmin,
  useModerateReview,
  useRemoveReviewMedia,
  useReviewAudit,
} from '../hooks/useAdminReviews';

const cardClass = 'rounded-xl border border-gray-200 bg-white p-4 shadow-xs';

function Shell({ children }) {
  return (
    <section className="space-y-4">
      <Link
        to="/admin/reviews"
        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Reviews
      </Link>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="text-sm break-words text-gray-900">
        {children || <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}

function History({ reviewId }) {
  const audit = useReviewAudit(reviewId);
  return (
    <section className={cardClass}>
      <h3 className="mb-3 text-sm font-bold text-gray-900">History</h3>
      {audit.isPending && <p className="text-xs text-gray-500">Loading the history…</p>}
      {audit.isError && (
        <p role="alert" className="text-xs text-red-600">
          We couldn&apos;t load the history of this review.
        </p>
      )}
      {audit.isSuccess && audit.data.length === 0 && (
        <p className="text-xs text-gray-500">No admin has acted on this review yet.</p>
      )}
      {audit.isSuccess && audit.data.length > 0 && (
        <ol className="space-y-2">
          {audit.data.map((entry) => (
            <li key={entry.id} className="text-xs">
              <p className="font-semibold text-gray-900">{entry.summary}</p>
              <p className="text-xs text-gray-500">
                {entry.actorEmail || 'Database'} · {formatDateTime(entry.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MediaItem({ item, number, onRemove }) {
  const isVideo = item.type === 'video';
  const details = [
    formatBytes(item.bytes),
    item.width && item.height ? `${item.width}×${item.height}` : null,
    isVideo && item.durationSeconds !== null ? formatDuration(item.durationSeconds) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="space-y-1.5">
      {isVideo ? (
        <video
          src={item.url}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-lg bg-black"
        />
      ) : (
        <a href={largeUrl(item.url, 2000)} target="_blank" rel="noopener noreferrer">
          <img
            src={thumbnailUrl(item.url, 480)}
            alt={`Customer photo ${number}`}
            className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
          />
        </a>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {isVideo ? 'Video' : `Photo ${number}`} · {details}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={isVideo ? 'Remove video' : `Remove photo ${number}`}
          className={`cursor-pointer rounded-md border border-red-200 px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-50 max-md:min-h-11 max-md:flex max-md:items-center ${focusRing}`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

/** One review for a moderator: the full text, the gallery, who wrote it, and the decision. */
export default function AdminReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useAdminReview(id);
  const moderate = useModerateReview();
  const deleteReview = useDeleteReviewAsAdmin();
  const removeMedia = useRemoveReviewMedia();
  const review = query.data;

  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null); // { kind: 'approved' | 'rejected' | 'delete' | 'media', media? }
  const [dialogError, setDialogError] = useState('');

  // Stable on purpose: the dialog re-focuses its Cancel button whenever onCancel changes.
  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogError('');
  }, []);

  if (!isUuid(id) || review === null) {
    return (
      <Shell>
        <div className={`${cardClass} text-center`}>
          <h2 className="text-base font-semibold text-gray-900">We couldn&apos;t find that review</h2>
          <p className="mt-1 text-xs text-gray-500">
            It may have been deleted or the link is wrong.
          </p>
        </div>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-bold text-red-700">We couldn&apos;t load this review.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-3 cursor-pointer rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }
  if (!review) {
    return (
      <Shell>
        <p role="status" className="py-12 text-center text-xs text-gray-500">
          Loading the review…
        </p>
      </Shell>
    );
  }

  const busy = moderate.isPending || deleteReview.isPending || removeMedia.isPending;
  const who = `${review.authorName} on "${review.productTitle}"`;

  const confirm = () => {
    setDialogError('');
    const failed = (error) => setDialogError(error.message);

    if (dialog.kind === 'approved' || dialog.kind === 'rejected') {
      moderate.mutate(
        { id: review.id, status: dialog.kind },
        {
          onSuccess: (result) => {
            closeDialog();
            setNotice(
              !result.changed
                ? 'Nothing changed: the review already had that status.'
                : dialog.kind === 'approved'
                  ? `Review by ${review.authorName} approved.`
                  : `Review by ${review.authorName} rejected.`,
            );
          },
          onError: failed,
        },
      );
    } else if (dialog.kind === 'delete') {
      deleteReview.mutate(
        { id: review.id },
        { onSuccess: () => navigate('/admin/reviews', { replace: true }), onError: failed },
      );
    } else if (dialog.kind === 'media') {
      removeMedia.mutate(
        { mediaId: dialog.media.id },
        {
          onSuccess: () => {
            closeDialog();
            setNotice(`The ${dialog.media.type} was removed from this review.`);
          },
          onError: failed,
        },
      );
    }
  };

  const dialogText = {
    approved: {
      title: 'Approve this review?',
      label: 'Approve',
      danger: false,
      body: 'It will appear on the product page with its photos and video, and count towards the rating.',
    },
    rejected: {
      title: 'Reject this review?',
      label: 'Reject',
      danger: true,
      body: 'It will be hidden from the product page and removed from the rating. The customer will see "Not approved".',
    },
    delete: {
      title: 'Delete this review?',
      label: 'Delete review',
      danger: true,
      body: 'This permanently removes the review and its photos and video. This cannot be undone.',
    },
    media: {
      title: `Remove this ${dialog?.media?.type}?`,
      label: `Remove ${dialog?.media?.type}`,
      danger: true,
      body: 'The file is deleted. The review and its other files stay.',
    },
  }[dialog?.kind];

  return (
    <Shell>
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review by {review.authorName}</h2>
          <p className="text-xs text-gray-500">
            On{' '}
            {review.productSlug ? (
              <Link to={`/product/${review.productSlug}`} className="font-semibold text-blue-600 hover:underline">
                {review.productTitle}
              </Link>
            ) : (
              review.productTitle
            )}{' '}
            · written {formatDateTime(review.createdAt)}
          </p>
        </div>
        <ReviewStatusBadge status={review.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className={`${cardClass} space-y-3`}>
            <div className="flex items-center gap-2">
              <Stars rating={review.rating} size={16} />
              {review.verified && (
                <span className="text-xs font-bold text-green-700">Verified Purchase</span>
              )}
            </div>
            {review.title && <h3 className="text-sm font-bold text-gray-900">{review.title}</h3>}
            {review.comment ? (
              <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700">
                {review.comment}
              </p>
            ) : (
              <p className="text-sm text-gray-400">(Rating only, no written review.)</p>
            )}
          </section>

          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Photos and video ({review.media.length})
            </h3>
            {review.media.length === 0 ? (
              <p className="text-xs text-gray-500">This review has no photos or video.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {review.media.map((item) => (
                  <MediaItem
                    key={item.id}
                    item={item}
                    number={review.media.filter((m) => m.type === 'photo').indexOf(item) + 1}
                    onRemove={() => setDialog({ kind: 'media', media: item })}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className={`${cardClass} space-y-3`}>
            <h3 className="text-sm font-bold text-gray-900">Decision</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || review.status === 'approved'}
                onClick={() => setDialog({ kind: 'approved' })}
                className={`cursor-pointer rounded-md bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 ${focusRing}`}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy || review.status === 'rejected'}
                onClick={() => setDialog({ kind: 'rejected' })}
                className={`cursor-pointer rounded-md bg-amber-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 ${focusRing}`}
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialog({ kind: 'delete' })}
                className={`cursor-pointer rounded-md border border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 ${focusRing}`}
              >
                Delete
              </button>
            </div>
            {review.moderatedAt && (
              <p className="text-xs text-gray-500">
                Last decision {formatDateTime(review.moderatedAt)}
              </p>
            )}
          </section>

          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Customer</h3>
            <dl className="space-y-2">
              <Field label="Shown as">{review.authorName}</Field>
              <Field label="Account email">{review.accountEmail}</Field>
              <Field label="Order">
                {review.orderId ? (
                  <Link
                    to={`/admin/orders/${review.orderId}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {review.orderNumber || 'View order'}
                  </Link>
                ) : null}
              </Field>
              <Field label="Last edited">
                {review.updatedAt !== review.createdAt ? formatDateTime(review.updatedAt) : null}
              </Field>
            </dl>
          </section>

          <History reviewId={review.id} />
        </div>
      </div>

      {dialog && dialogText && (
        <ConfirmDialog
          title={dialogText.title}
          confirmLabel={dialogText.label}
          danger={dialogText.danger}
          busy={busy}
          onCancel={closeDialog}
          onConfirm={confirm}
        >
          <span className="block font-semibold text-gray-800">{who}</span>
          {dialogText.body}
          {dialogError && (
            <span role="alert" className="mt-2 block text-red-600">
              {dialogError}
            </span>
          )}
        </ConfirmDialog>
      )}
    </Shell>
  );
}
