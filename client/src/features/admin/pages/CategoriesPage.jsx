import QueryState from '../components/QueryState';
import StatusBadge from '../components/StatusBadge';
import { useAdminCategories } from '../hooks/useAdminData';

export default function CategoriesPage() {
  const query = useAdminCategories();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">Categories</h2>
        <p className="text-xs text-gray-500">Read-only for now. Editing arrives in Phase 2.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
        <QueryState
          query={query}
          label="categories"
          isEmpty={query.data?.length === 0}
          emptyText="There are no categories yet."
        >
          <table className="w-full min-w-96 text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Slug</th>
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {query.data?.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-2 font-semibold text-gray-900">{category.name}</td>
                  <td className="px-4 py-2 text-gray-600">{category.slug}</td>
                  <td className="px-4 py-2 text-gray-600">{category.sortOrder}</td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={category.isActive ? 'green' : 'gray'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </div>
    </section>
  );
}
