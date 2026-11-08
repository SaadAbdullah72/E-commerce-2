import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartDrawer from './components/cart/CartDrawer';
import ShippingPage from './pages/ShippingPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import AuthConfirmPage from './features/auth/pages/AuthConfirmPage';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';
import SignupPage from './features/auth/pages/SignupPage';
import PrivacyPage from './features/legal/pages/PrivacyPage';
import TermsPage from './features/legal/pages/TermsPage';
import { mockProducts } from './data/mockProducts';
import ProfilePage from './pages/ProfilePage';
import MyOrdersPage from './pages/MyOrdersPage';
import AdminDashboard from './pages/AdminDashboard';
import authService from './services/authService';

function ProtectedRoute({ children, isLoggedIn }) {
  if (!isLoggedIn) {
    return <Navigate to="/login?redirect=shipping" replace />;
  }
  return children;
}

function AdminRoute({ children, isLoggedIn }) {
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  if (!authService.isAdmin()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

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
      onSelectProduct={(product) => navigate(`/product/${product._id}`)}
      onNavigateHome={() => navigate('/')}
      onSelectCategory={(catName) => navigate(`/category/${catName.toLowerCase()}`)}
    />
  );
}

function ProductDetailRouteWrapper({ isLoggedIn }) {
  const { productId } = useParams();
  const navigate = useNavigate();

  const product = mockProducts.find((p) => String(p._id) === String(productId));

  return (
    <ProductDetailPage
      product={product}
      isLoggedIn={isLoggedIn}
      onNavigateHome={() => navigate('/')}
      onSelectCategory={(catName) => navigate(`/category/${catName.toLowerCase()}`)}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(() => authService.isAuthenticated());
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleLogout = () => {
    authService.logout();
    setIsLoggedIn(false);
  };

  // Check if current route is under the admin dashboard
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdmin = authService.isAdmin();

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
              onSelectProduct={(product) => navigate(`/product/${product._id}`)}
            />
          }
        />
        <Route path="/category/:categoryName" element={<CategoryRouteWrapper />} />
        <Route
          path="/product/:productId"
          element={<ProductDetailRouteWrapper isLoggedIn={isLoggedIn} />}
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <ProfilePage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/login"
          element={<LoginPage onLoginSuccess={(status) => setIsLoggedIn(status)} />}
        />
        {/* Legacy URL kept so old links (e.g. from the login page) still work. */}
        <Route path="/signin" element={<LegacySigninRedirect />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route
          path="/shipping"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <ShippingPage onProceedToPayment={() => navigate('/checkout')} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/admin" 
          element={
            <AdminRoute isLoggedIn={isLoggedIn}>
              <AdminDashboard onLogout={handleLogout} />
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