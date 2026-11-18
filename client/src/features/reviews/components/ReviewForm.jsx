import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { useMediaUploads } from '../hooks/useMediaUploads';
import { useEditReview, useSubmitReview } from '../hooks/useReviews';
import {
  MAX_COMMENT,
  MAX_TITLE,
  validateComment,
  validateRating,
  validateTitle,
} from '../lib/reviewRules';
import MediaPicker from './MediaPicker';
import { StarPicker } from './Stars';

const fieldClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 aria-[invalid=true]:border-red-500';

/**
 * Write a review, or edit your own. Files upload as soon as they are chosen; sending is possible
 * once every file has finished (or been removed).
 *
 * @param {{ productId: string, existing?: null | { id: string, rating: number, title: string | null,
 *   comment: string | null, media: any[] }, onSaved: (kind: 'created' | 'edited') => void,
 *   onCancel?: () => void }} props
 */
export default function ReviewForm({ productId, existing = null, onSaved, onCancel }) {
  const editing = Boolean(existing);
  // The files are uploaded into a folder named after this id, so it exists before the review does.
  const [reviewId] = useState(() => existing?.id ?? crypto.randomUUID());
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState('');

  const uploads = useMediaUploads(reviewId, existing?.media ?? []);
  const submit = useSubmitReview();
  const edit = useEditReview();
  const saving = submit.isPending || edit.isPending;

  const errors = {
    rating: validateRating(rating),
    title: validateTitle(title),
    comment: validateComment(comment),
  };
  const hasErrors = Boolean(errors.rating || errors.title || errors.comment);
  const waiting = uploads.busy
    ? 'Waiting for your files to finish uploading.'
    : uploads.hasError
      ? 'Retry or remove the files that failed.'
      : '';

  const send = (event) => {
    event.preventDefault();
    setTried(true);
    setServerError('');
    if (hasErrors || uploads.busy || uploads.hasError) return;

    const values = { rating, title, comment, media: uploads.media };
    const options = {
      onSuccess: () => onSaved(editing ? 'edited' : 'created'),
      onError: (error) => setServerError(error.message),
    };
    if (editing) edit.mutate({ id: reviewId, ...values }, options);
    else submit.mutate({ id: reviewId, productId, ...values }, options);
  };

  return (
    <form
      onSubmit={send}
      noValidate
      aria-label={editing ? 'Edit your review' : 'Write a review'}
      className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
    >
      <div>
        <h3 className="text-sm font-black text-gray-900">
          {editing ? 'Edit your review' : 'Write a review'}
        </h3>
        {editing && (
          <p className="mt-1 text-xs text-amber-700">
            Editing sends your review for approval again. It may take up to 24 hours.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-gray-900" id="rating-label">
          Your rating
        </p>
        <StarPicker
          value={rating}
          onChange={setRating}
          describedBy={tried && errors.rating ? 'rating-error' : undefined}
          invalid={tried && Boolean(errors.rating)}
          disabled={saving}
        />
        {tried && errors.rating && (
          <p id="rating-error" role="alert" className="text-xs text-red-600">
            {errors.rating}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="review-title" className="text-xs font-bold text-gray-900">
          Title (optional)
        </label>
        <input
          id="review-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_TITLE + 20}
          aria-invalid={Boolean(errors.title)}
          aria-describedby="review-title-help"
          disabled={saving}
          autoComplete="off"
          className={fieldClass}
        />
        <p
          id="review-title-help"
          role={errors.title ? 'alert' : undefined}
          className={`text-[11px] ${errors.title ? 'text-red-600' : 'text-gray-500'}`}
        >
          {errors.title || `${title.trim().length}/${MAX_TITLE}`}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="review-comment" className="text-xs font-bold text-gray-900">
          Your review (optional)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={5}
          aria-invalid={Boolean(errors.comment)}
          aria-describedby="review-comment-help"
          disabled={saving}
          className={fieldClass}
        />
        <p
          id="review-comment-help"
          role={errors.comment ? 'alert' : undefined}
          className={`text-[11px] ${errors.comment ? 'text-red-600' : 'text-gray-500'}`}
        >
          {errors.comment || `${comment.trim().length}/${MAX_COMMENT}`}
        </p>
      </div>

      <MediaPicker uploads={uploads} disabled={saving} />

      {serverError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving || uploads.busy || uploads.hasError}
          aria-describedby={waiting ? 'review-wait' : undefined}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
          {saving ? 'Sending…' : editing ? 'Save and send for approval' : 'Submit review'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        {waiting && (
          <p id="review-wait" role="status" className="text-[11px] text-gray-500">
            {waiting}
          </p>
        )}
      </div>
    </form>
  );
}
