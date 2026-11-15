import { MessageSquare, Star } from 'lucide-react';

/**
 * Customer reviews for one product (read-only).
 *
 * There is no reviews feature behind this yet, so it receives no reviews and shows
 * "No reviews yet." Nothing here is invented: no sample reviews, no names, and no
 * "verified purchase" label (that would need a real check against a real order).
 * When real reviews exist, pass them in as `reviews`:
 * `{ id, userName, rating (1-5), date, comment }`.
 *
 * @param {{ reviews?: { id: string, userName: string, rating: number, date: string, comment: string }[] }} props
 */
export default function ProductReviewsSection({ reviews = [] }) {
  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <section
      aria-label="Customer reviews"
      className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 font-sans shadow-xs"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-xs font-bold tracking-wider text-gray-900 uppercase">
            Customer Reviews ({reviews.length})
          </h2>
        </div>

        {average && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="font-bold text-gray-900">{average}</span>
            <span className="font-normal text-gray-400">/ 5.0</span>
          </div>
        )}
      </div>

      {reviews.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {reviews.map((item) => (
            <li key={item.id} className="py-4 first:pt-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-900">{item.userName}</span>
                <span className="text-[10px] text-gray-400">{item.date}</span>
              </div>
              <div
                className="mb-2 flex items-center text-amber-400"
                role="img"
                aria-label={`${item.rating} out of 5 stars`}
              >
                {[0, 1, 2, 3, 4].map((index) => (
                  <Star
                    key={index}
                    size={12}
                    aria-hidden="true"
                    className={
                      index < item.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                    }
                  />
                ))}
              </div>
              <p className="text-xs leading-relaxed text-gray-600">{item.comment}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-xs text-gray-400">No reviews yet.</p>
      )}
    </section>
  );
}
