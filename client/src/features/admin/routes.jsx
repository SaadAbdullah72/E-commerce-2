import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from './components/AdminLayout';
import CategoriesPage from './pages/CategoriesPage';
import ComingSoonPage from './pages/ComingSoonPage';
import OverviewPage from './pages/OverviewPage';
import ProductsPage from './pages/ProductsPage';

/** Mounted at /admin/* behind AdminRoute. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="orders" element={<ComingSoonPage />} />
        <Route path="coupons" element={<ComingSoonPage />} />
        <Route path="banners" element={<ComingSoonPage />} />
        <Route path="logs" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
