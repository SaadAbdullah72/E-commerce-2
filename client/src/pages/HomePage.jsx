import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';
import HeroSlider from '../components/home/HeroSlider';
import FlashTimer from '../components/product/FlashTimer';
import {
  CatalogEmpty,
  CatalogError,
  ProductGridSkeleton,
} from '../features/catalog/components/CatalogStates';
import { useCategories, useDealTags, useProducts } from '../features/catalog/hooks/useCatalog';
import { resolveFilters } from '../features/catalog/lib/resolveFilters';

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4';

/** The soonest flash-deal end time that is still in the future, or null. */
function nextFlashEnd(products) {
  const now = Date.now();
  const ends = products
    .filter((product) => product.isFlashDeal && product.flashEndsAt)
    .map((product) => new Date(product.flashEndsAt).getTime())
    .filter((time) => time > now);
  return ends.length > 0 ? new Date(Math.min(...ends)).toISOString() : null;
}

export default function HomePage({ onSelectProduct, selectedCategory, onSelectCategory }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') || '';

  const categoriesQuery = useCategories();
  const dealTagsQuery = useDealTags();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const dealTags = useMemo(() => dealTagsQuery.data ?? [], [dealTagsQuery.data]);

  // A menu label (category or deal) is turned into database ids once those lists are loaded.
  const isResolving =
    !keyword && Boolean(selectedCategory) && (categoriesQuery.isPending || dealTagsQuery.isPending);
  const { filters, isUnknown } = resolveFilters({
    keyword,
    selected: selectedCategory,
    categories,
    dealTags,
  });

  const productsQuery = useProducts(filters, { enabled: !isResolving && !isUnknown });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const isLoading = isResolving || (productsQuery.isPending && !isUnknown);
  const visibleProducts = isUnknown ? [] : products;

  const flashEnd = useMemo(() => nextFlashEnd(products), [products]);

  // A search or a picked deal/category switches the page into "results" mode.
  const isFilterActive = Boolean(keyword || selectedCategory);

  function renderProducts(emptyTitle, emptyText) {
    if (isLoading) return <ProductGridSkeleton />;
    if (productsQuery.isError) {
      return (
        <CatalogError message="We couldn't load the products." onRetry={() => productsQuery.refetch()} />
      );
    }
    if (visibleProducts.length === 0) return <CatalogEmpty title={emptyTitle} text={emptyText} />;
    return (
      <div className={GRID}>
        {visibleProducts.map((product) => (
          <ProductCard key={product._id} product={product} onSelectProduct={onSelectProduct} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        {isFilterActive ? (
          <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900">
                  {keyword ? (
                    <>
                      Search Results for <span className="text-blue-600">&quot;{keyword}&quot;</span>
                    </>
                  ) : (
                    <>
                      Results for <span className="text-blue-600">&quot;{selectedCategory}&quot;</span>
                    </>
                  )}
                </h1>
                {!isLoading && !productsQuery.isError && (
                  <p className="text-xs text-gray-500 mt-1">
                    Found {visibleProducts.length} item(s)
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  if (keyword) setSearchParams({});
                  if (selectedCategory) onSelectCategory(null);
                }}
                className="text-xs font-bold text-gray-500 hover:text-orange-500 flex items-center gap-1 transition cursor-pointer"
              >
                <X size={14} /> Clear {keyword ? 'Search' : 'Filter'}
              </button>
            </div>

            {renderProducts(
              `No products found for "${keyword || selectedCategory}"`,
              'Try checking for spelling errors or pick a different category.',
            )}
          </div>
        ) : (
          <>
            <HeroSlider />

            {/* Category circle navigation (from the database) */}
            {categories.length > 0 && (
              <div className="my-6 flex flex-wrap justify-center gap-4 sm:gap-6 text-center">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => onSelectCategory(selectedCategory === cat.name ? null : cat.name)}
                    className="flex flex-col items-center group cursor-pointer w-16 sm:w-20"
                  >
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition p-0.5 flex items-center justify-center bg-blue-50 ${
                        selectedCategory === cat.name
                          ? 'border-orange-500 ring-4 ring-orange-500/20 scale-105'
                          : 'border-gray-200 group-hover:border-orange-500'
                      }`}
                    >
                      {cat.iconUrl ? (
                        <img
                          src={cat.iconUrl}
                          alt=""
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span className="text-lg font-black text-blue-600" aria-hidden="true">
                          {cat.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold mt-1.5 text-gray-700 group-hover:text-orange-500 transition">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Flash deals banner: only when a real flash deal is running */}
            {flashEnd && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="bg-orange-500 text-white p-1.5 rounded-lg">
                    <Zap size={18} className="fill-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">
                      Flash Deals
                    </h2>
                    <p className="text-xs text-gray-500">Limited time offer</p>
                  </div>
                </div>

                <FlashTimer targetDate={flashEnd} />
              </div>
            )}

            {renderProducts('No products yet', 'Check back soon: new items are on the way.')}
          </>
        )}
      </div>
    </div>
  );
}
