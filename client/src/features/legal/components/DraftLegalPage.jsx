import { Link } from 'react-router-dom';

/**
 * Placeholder for legal pages until approved text exists. Deliberately contains no
 * invented legal wording.
 *
 * @param {object} props
 * @param {string} props.title
 */
export default function DraftLegalPage({ title }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div
        role="note"
        className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900"
      >
        DRAFT — not legal text
      </div>

      <h1 className="text-2xl font-black text-gray-900">{title}</h1>
      <p className="mt-3 text-sm text-gray-600">
        This page is a placeholder. The final {title.toLowerCase()} has not been written or reviewed
        yet and must be added before ShopYaro launches.
      </p>
      {/* TODO(legal): replace this placeholder with the approved text. */}

      <Link
        to="/signup"
        className="mt-6 inline-block text-sm font-bold text-blue-600 hover:underline"
      >
        Back to sign up
      </Link>
    </main>
  );
}
