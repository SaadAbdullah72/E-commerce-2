import React, { useState } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartDrawer from './components/cart/CartDrawer';
import ShippingPage from './pages/ShippingPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import SigninPage from './pages/SigninPage';
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
      {/* Conditionally render Navbar ONLY on storefront routes */}
      {!isAdminRoute && (
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
        <Route
          path="/signin"
          element={<SigninPage onRegisterSuccess={(status) => setIsLoggedIn(status)} />}
        />

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

        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>

      {/* Conditionally render CartDrawer ONLY on storefront routes */}
      {!isAdminRoute && (
        <CartDrawer
          onCheckout={() => navigate(isLoggedIn ? '/shipping' : '/login?redirect=shipping')}
        />
      )}
    </div>
  );
}