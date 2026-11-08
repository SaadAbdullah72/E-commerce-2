import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import ProductCard from '../components/product/ProductCard';
import {
  CatalogEmpty,
  CatalogError,
  ProductGridSkeleton,
} from '../features/catalog/components/CatalogStates';
import { useCategories, useProducts } from '../features/catalog/hooks/useCatalog';

/** URLs use the category slug (/category/home-kitchen); older links used the lower-cased name. */
function findCategory(categories, param) {
  const wanted = decodeURIComponent(param ?? '').toLowerCase();
  return categories.find(
    (category) => category.slug === wanted || category.name.toLowerCase() === wanted,
  );
}

export default function CategoryPage({
  categoryName,
  onSelectProduct,
  onNavigateHome,
  onSelectCategory,
}) {
  const categoriesQuery = useCategories();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const category = findCategory(categories, categoryName);

  const productsQuery = useProducts(
    { categoryId: category?.id },
    { enabled: Boolean(category) },
  );
  const products = productsQuery.data ?? [];

  const title = category?.name ?? decodeURIComponent(categoryName ?? '');
  const categoryUnknown = categoriesQuery.isSuccess && !category;

  function renderMain() {
    if (categoriesQuery.isError || productsQuery.isError) {
      return (
        <CatalogError
          message="We couldn't load this category."
          onRetry={() => {
            categoriesQuery.refetch();
            productsQuery.refetch();
          }}
        />
      );
    }
    if (categoriesQuery.isPending || (category && productsQuery.isPending)) {
      return <ProductGridSkeleton count={6} className="lg:grid-cols-4" />;
    }
    if (categoryUnknown || products.length === 0) {
      return (
        <CatalogEmpty
          title={categoryUnknown ? 'Category not found' : 'No products found'}
          text={
            categoryUnknown
              ? 'This category does not exist or is no longer available.'
              : 'There are no items currently in this category.'
          }
        />
      );
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} onSelectProduct={onSelectProduct} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Breadcrumb Line */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
          <button onClick={onNavigateHome} className="hover:text-blue-600 transition">
            Home
          </button>
          <ChevronRight size={12} className="text-gray-400" />
          <span className="text-gray-400">Categories</span>
          <ChevronRight size={12} className="text-gray-400" />
          <span className="text-gray-900 font-semibold capitalize">{title}</span>
        </div>

        {/* 2-Column Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-3 bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Categories
            </h2>

            <nav className="space-y-1">
              {categories.map((cat) => {
                const isActive = cat.id === category?.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onSelectCategory && onSelectCategory(cat.slug)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full text-left px-3 py-2 text-xs rounded-md transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-bold'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="lg:col-span-9">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-6">
              <h1 className="text-xl font-bold text-gray-900 capitalize">{title}</h1>
              {productsQuery.isSuccess && (
                <span className="text-xs text-gray-500 font-medium">{products.length} products</span>
              )}
            </div>

            {renderMain()}
          </main>
        </div>
      </div>
    </div>
  );
}
