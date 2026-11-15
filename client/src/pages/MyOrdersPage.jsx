import { Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * My Orders. Orders are not built yet, so this honestly says there are none.
 * (The real list, with tracking, arrives with the orders phase.)
 */
export default function MyOrdersPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">My Orders</h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Package size={28} aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-gray-900">No orders yet</h2>
          <p className="mt-1 text-xs text-gray-500">
            When you place an order, it will appear here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
          >
            Start shopping
          </button>
        </div>
      </div>
    </div>
  );
}
