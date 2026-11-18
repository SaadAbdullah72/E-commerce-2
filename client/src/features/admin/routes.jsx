import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from './components/AdminLayout';
import AdminOrderDetailPage from './pages/AdminOrderDetailPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BannerEditPage from './pages/BannerEditPage';
import BannersPage from './pages/BannersPage';
import CategoriesPage from './pages/CategoriesPage';
import CouponEditPage from './pages/CouponEditPage';
import CouponsPage from './pages/CouponsPage';
import LogsPage from './pages/LogsPage';
import OverviewPage from './pages/OverviewPage';
import ProductEditPage from './pages/ProductEditPage';
import ProductsPage from './pages/ProductsPage';

/** Mounted at /admin/* behind AdminRoute. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductEditPage />} />
        <Route path="products/:id" element={<ProductEditPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="coupons/new" element={<CouponEditPage />} />
        <Route path="coupons/:id" element={<CouponEditPage />} />
        <Route path="banners" element={<BannersPage />} />
        <Route path="banners/new" element={<BannerEditPage />} />
        <Route path="banners/:id" element={<BannerEditPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
