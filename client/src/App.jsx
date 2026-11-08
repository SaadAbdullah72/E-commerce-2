import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartDrawer from './components/cart/CartDrawer';
import ShippingPage from './pages/ShippingPage';
import CheckoutPage from './pages/CheckoutPage';
import AdminRoute from './features/auth/components/AdminRoute';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import { useAuth } from './features/auth/hooks/useAuth';
import LoginPage from './features/auth/pages/LoginPage';
import AuthCallbackPage from './features/auth/pages/AuthCallbackPage';
import AuthConfirmPage from './features/auth/pages/AuthConfirmPage';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';
import SignupPage from './features/auth/pages/SignupPage';
import PrivacyPage from './features/legal/pages/PrivacyPage';
import TermsPage from './features/legal/pages/TermsPage';
import ProfilePage from './pages/ProfilePage';
import MyOrdersPage from './pages/MyOrdersPage';
import AuthLoading from './features/auth/components/AuthLoading';

// The admin area is loaded only when an admin visits it, which keeps the storefront bundle small.
const AdminRoutes = lazy(() => import('./features/admin/routes'));

// Old /signin links carry ?redirect=...; keep it (SignupPage validates it against an allow-list).
function LegacySigninRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/signup${search}`} replace />;
}

function CategoryRouteWrapper() {
  const { categoryName } = useParams();
  const navigate = useNavigate();

  return (
    <CategoryPage
      categoryName={categoryName}
      onSelectProduct={(product) => navigate(`/product/${product.slug}`)}
      onNavigateHome={() => navigate('/')}
      onSelectCategory={(catName) => navigate(`/category/${catName.toLowerCase()}`)}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, isAdmin, signOut } = useAuth();
  const isLoggedIn = status === 'authenticated';
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleLogout = () => signOut();

  // Check if current route is under the admin dashboard
  const isAdminRoute = location.pathname.startsWith('/admin');

  // If logged in as admin, force direct access to /admin dashboard (admin cannot shop)
  useEffect(() => {
    if (isLoggedIn && isAdmin && !location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true });
    }
  }, [isLoggedIn, isAdmin, location.pathname, navigate]);

  const handleSelectCategory = (catName) => {
    if (!catName) {
      setSelectedCategory(null);
      return;
    }

    setSelectedCategory(catName);
    const lowerCat = catName.toLowerCase();

    if (
      lowerCat === 'under $5 store' ||
      lowerCat === '50% off clearance' ||
      lowerCat === 'top rated items' ||
      lowerCat === 'lightning deals' ||
      lowerCat === 'buy 1 get 1 free' ||
      lowerCat === 'free shipping deals'
    ) {
      navigate('/');
    } else {
      navigate(`/category/${lowerCat}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Conditionally render Navbar ONLY on storefront routes and for non-admins */}
      {!isAdminRoute && !isAdmin && (
        <Navbar onSelectCategory={handleSelectCategory} />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onSelectProduct={(product) => navigate(`/product/${product.slug}`)}
            />
          }
        />
        <Route path="/category/:categoryName" element={<CategoryRouteWrapper />} />
        <Route
          path="/product/:slug"
          element={<ProductDetailPage isLoggedIn={isLoggedIn} />}
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />
        {/* Legacy URL kept so old links (e.g. from the login page) still work. */}
        <Route path="/signin" element={<LegacySigninRedirect />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route
          path="/shipping"
          element={
            <ProtectedRoute>
              <ShippingPage onProceedToPayment={() => navigate('/checkout')} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/admin/*"
          element={
            <AdminRoute>
              <Suspense fallback={<AuthLoading />}>
                <AdminRoutes />
              </Suspense>
            </AdminRoute>
          }
        />
      </Routes>

      {/* Conditionally render CartDrawer ONLY on storefront routes and for non-admins */}
      {!isAdminRoute && !isAdmin && (
        <CartDrawer
          onCheckout={() => navigate(isLoggedIn ? '/shipping' : '/login?redirect=shipping')}
        />
      )}
    </div>
  );
}