/**
 * Shared card layout for every auth page.
 *
 * @param {object} props
 * @param {import('react').ComponentType<{ size?: number }>} [props.icon] lucide icon shown above the title
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {import('react').ReactNode} props.children
 * @param {import('react').ReactNode} [props.footer] Links shown under the card content
 */
export default function AuthLayout({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6 text-center">
          {Icon && (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon size={20} />
            </div>
          )}
          <h1 className="text-xl font-black text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>

        {children}

        {footer && (
          <div className="mt-6 border-t border-gray-100 pt-6 text-center text-xs text-gray-500">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
