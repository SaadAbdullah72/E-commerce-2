import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Plus,
  Trash2,
  Edit,
  Search,
  DollarSign,
  Users,
  X,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Ticket,
  Megaphone,
  History,
  Minus,
  Eye,
  Palette,
  Zap,
  Tag
} from 'lucide-react';
import { mockProducts as initialProducts } from '../data/mockProducts';

// Available Special Deal Tag Classifications
const DEAL_TAG_OPTIONS = [
  'Lightning Deals',
  'Under $5 Store',
  '50% OFF Clearance',
  'Buy 1 Get 1 Free',
  'Free Shipping Deals',
  'Top Rated Items'
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');

  // Datasets
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState([
    'Electronics',
    'Fashion',
    'Home & Kitchen',
    'Footwear',
    'Beauty'
  ]);
  const [orders, setOrders] = useState([
    {
      id: 'SY-89421',
      customer: 'Hashir Mohi-ud-din',
      email: 'hashir@example.com',
      address: 'House #12, Sector F-8, Islamabad',
      items: [{ title: 'JYSUPER 2526 Fan', qty: 1, price: 19.99, size: 'Standard', color: 'Black' }],
      total: 32.49,
      status: 'Shipped',
      date: 'Oct 24, 2026',
    }
  ]);

  const [storeBanner, setStoreBanner] = useState({
    announcementText: '⚡ FLASH SALE: Free Express Shipping on Orders Over $20! ⚡',
    heroHeading: 'MEGA ELECTRONICS DEALS',
    heroSubheading: 'Up to 50% Off Top Rated Gadgets & Accessories',
  });

  const [coupons, setCoupons] = useState([
    { code: 'SHOPYARO10', type: 'Percentage', value: 10, uses: 42, active: true },
    { code: 'FLASHSALE5', type: 'Fixed ($)', value: 5, uses: 18, active: true },
  ]);

  const [auditLogs, setAuditLogs] = useState([
    { id: 'log-1', action: 'System Initialized', user: 'Admin (Huzaifa)', timestamp: 'Just now' },
  ]);

  // UI States
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState('');
  const [viewingOrder, setViewingOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);

  // New Color Picker State
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#0F52BA');

  // Product Form State
  const [productForm, setProductForm] = useState({
    title: '',
    price: '',
    originalPrice: '',
    category: 'Electronics',
    dealTags: ['Lightning Deals'], // Special deal tag classifications
    stock: '',
    description: '',
    images: [''],
    sizes: ['Standard'],
    colors: [{ name: 'Electric Blue', hex: '#0F52BA' }],
  });

  const [couponForm, setCouponForm] = useState({ code: '', type: 'Percentage', value: '' });

  // Helpers
  const logAdminAction = (actionText) => {
    const newEntry = {
      id: `log-${Date.now()}`,
      action: actionText,
      user: 'Huzaifa Javid',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const showNotification = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Stock Adjuster
  const handleAdjustStock = (id, delta) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p._id === id) {
          const newStock = Math.max(0, (p.stock || 0) + delta);
          logAdminAction(`Stock for "${p.title}" adjusted to ${newStock}`);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );
  };

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setProductForm({
      title: '',
      price: '',
      originalPrice: '',
      category: categories[0] || 'Electronics',
      dealTags: ['Lightning Deals'],
      stock: '10',
      description: '',
      images: [''],
      sizes: ['Standard'],
      colors: [{ name: 'Electric Blue', hex: '#0F52BA' }],
    });
    setNewColorName('');
    setNewColorHex('#0F52BA');
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product._id);
    setProductForm({
      title: product.title || '',
      price: product.price || '',
      originalPrice: product.originalPrice || '',
      category: product.category || categories[0],
      dealTags: product.dealTags || [],
      stock: product.stock || '',
      description: product.description || '',
      images: product.images && product.images.length > 0 ? product.images : [product.image || ''],
      sizes: product.sizes || ['Standard'],
      colors: product.colors && product.colors.length > 0 ? product.colors : [{ name: 'Default', hex: '#111827' }],
    });
    setNewColorName('');
    setNewColorHex('#0F52BA');
    setIsProductModalOpen(true);
  };

  // Toggle Special Deal Tag Selection
  const handleToggleDealTag = (tag) => {
    setProductForm((prev) => {
      const exists = prev.dealTags.includes(tag);
      return {
        ...prev,
        dealTags: exists
          ? prev.dealTags.filter((t) => t !== tag)
          : [...prev.dealTags, tag],
      };
    });
  };

  // Color Variant Add/Remove
  const handleAddColorVariant = () => {
    if (!newColorName.trim()) return;
    setProductForm({
      ...productForm,
      colors: [...productForm.colors, { name: newColorName.trim(), hex: newColorHex }],
    });
    setNewColorName('');
  };

  const handleRemoveColorVariant = (idx) => {
    setProductForm({
      ...productForm,
      colors: productForm.colors.filter((_, i) => i !== idx),
    });
  };

  // Delete Product
  const handleConfirmDelete = () => {
    if (!productToDelete) return;
    setProducts(products.filter((p) => String(p._id) !== String(productToDelete._id)));
    logAdminAction(`Deleted product "${productToDelete.title}"`);
    showNotification(`Product "${productToDelete.title}" deleted`, 'danger');
    setProductToDelete(null);
  };

  // Save Product
  const handleSaveProduct = (e) => {
    e.preventDefault();

    const formattedProduct = {
      _id: editingProduct || `prod_${Date.now()}`,
      title: productForm.title,
      price: parseFloat(productForm.price) || 0,
      originalPrice: productForm.originalPrice ? parseFloat(productForm.originalPrice) : null,
      category: productForm.category,
      dealTags: productForm.dealTags,
      stock: parseInt(productForm.stock, 10) || 0,
      description: productForm.description,
      images: productForm.images.filter((img) => img.trim() !== ''),
      sizes: productForm.sizes.filter((s) => s.trim() !== ''),
      colors: productForm.colors,
      ratings: editingProduct ? products.find((p) => p._id === editingProduct)?.ratings || 5.0 : 5.0,
      reviewsCount: editingProduct ? products.find((p) => p._id === editingProduct)?.reviewsCount || 0 : 0,
    };

    if (editingProduct) {
      setProducts(products.map((p) => (p._id === editingProduct ? formattedProduct : p)));
      logAdminAction(`Updated product "${formattedProduct.title}" classification`);
      showNotification(`Product "${formattedProduct.title}" updated`, 'success');
    } else {
      setProducts([formattedProduct, ...products]);
      logAdminAction(`Created product "${formattedProduct.title}"`);
      showNotification(`Product "${formattedProduct.title}" created`, 'success');
    }

    setIsProductModalOpen(false);
  };

  // Bulk Selection Handlers
  const handleSelectAllProducts = (e) => {
    if (e.target.checked) {
      setSelectedProductIds(filteredProducts.map((p) => p._id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleToggleSelectProduct = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    setProducts(products.filter((p) => !selectedProductIds.includes(p._id)));
    logAdminAction(`Bulk deleted ${selectedProductIds.length} products`);
    showNotification(`Deleted ${selectedProductIds.length} products`, 'danger');
    setSelectedProductIds([]);
  };

  const handleBulkCategoryAssign = () => {
    if (!bulkCategoryTarget) return;
    setProducts(
      products.map((p) =>
        selectedProductIds.includes(p._id) ? { ...p, category: bulkCategoryTarget } : p
      )
    );
    logAdminAction(`Assigned ${selectedProductIds.length} items to category "${bulkCategoryTarget}"`);
    showNotification(`Assigned selected items to ${bulkCategoryTarget}`, 'success');
    setSelectedProductIds([]);
  };

  const handleOrderStatusChange = (orderId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    logAdminAction(`Order #${orderId} marked as ${newStatus}`);
    showNotification(`Order #${orderId} updated to ${newStatus}`, 'success');
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;
    if (!categories.includes(newCategoryInput.trim())) {
      setCategories([...categories, newCategoryInput.trim()]);
      logAdminAction(`Added category "${newCategoryInput.trim()}"`);
      showNotification(`Category "${newCategoryInput.trim()}" added`, 'success');
    }
    setNewCategoryInput('');
  };

  const handleDeleteCategory = (cat) => {
    setCategories(categories.filter((c) => c !== cat));
    logAdminAction(`Removed category "${cat}"`);
    showNotification(`Category "${cat}" removed`, 'danger');
  };

  const handleSaveBanner = (e) => {
    e.preventDefault();
    logAdminAction('Updated store banner');
    showNotification('Store banner saved', 'success');
  };

  const handleCreateCoupon = (e) => {
    e.preventDefault();
    if (!couponForm.code.trim() || !couponForm.value) return;

    const newCoupon = {
      code: couponForm.code.trim().toUpperCase(),
      type: couponForm.type,
      value: parseFloat(couponForm.value),
      uses: 0,
      active: true,
    };

    setCoupons([newCoupon, ...coupons]);
    logAdminAction(`Created promo code "${newCoupon.code}"`);
    showNotification(`Coupon "${newCoupon.code}" created!`, 'success');
    setCouponForm({ code: '', type: 'Percentage', value: '' });
  };

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.dealTags && p.dealTags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row relative">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all duration-300 bg-white border-gray-200">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
          )}
          <span className="text-gray-900">{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div>
            <span className="text-xl font-black text-gray-900 tracking-tight block">
              Shop<span className="text-orange-500">Yaro</span>
            </span>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mt-0.5">
              Admin Operations
            </span>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'overview' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard size={16} />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'products' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Package size={16} />
              <span>Products ({products.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'orders' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ShoppingBag size={16} />
              <span>Orders ({orders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'categories' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FolderTree size={16} />
              <span>Categories ({categories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('banners')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'banners' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Megaphone size={16} />
              <span>Banners & Ticker</span>
            </button>

            <button
              onClick={() => setActiveTab('coupons')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'coupons' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Ticket size={16} />
              <span>Coupons ({coupons.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'logs' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History size={16} />
              <span>Activity Log</span>
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-gray-100 mt-6">
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Exit to Storefront</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Platform Analytics Overview</h1>
              <p className="text-xs text-gray-500 mt-0.5">Real-time metrics and inventory status.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                  <DollarSign size={18} className="text-emerald-600" />
                </div>
                <span className="text-2xl font-black text-gray-900">$12,480.50</span>
                <span className="text-[11px] font-bold text-emerald-600 block mt-1">+14% this week</span>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Products</span>
                  <Package size={18} className="text-blue-600" />
                </div>
                <span className="text-2xl font-black text-gray-900">{products.length}</span>
                <span className="text-[11px] font-bold text-blue-600 block mt-1">Across {categories.length} categories</span>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
                  <ShoppingBag size={18} className="text-orange-500" />
                </div>
                <span className="text-2xl font-black text-gray-900">{orders.length}</span>
                <span className="text-[11px] font-bold text-orange-500 block mt-1">Fulfillment active</span>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Customers</span>
                  <Users size={18} className="text-indigo-600" />
                </div>
                <span className="text-2xl font-black text-gray-900">890</span>
                <span className="text-[11px] font-bold text-indigo-600 block mt-1">98.4% satisfaction</span>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Product Catalog & Classifications</h1>
                <p className="text-xs text-gray-500 mt-0.5">Manage inventory, deal tags, colors, and pricing.</p>
              </div>

              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Add New Product
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 border border-gray-200 rounded-2xl shadow-xs">
              <div className="relative flex-1 min-w-[240px]">
                <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by title, category, or deal tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              {selectedProductIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600">
                    {selectedProductIds.length} Selected
                  </span>

                  <select
                    value={bulkCategoryTarget}
                    onChange={(e) => setBulkCategoryTarget(e.target.value)}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="">Move Category...</option>
                    {categories.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleBulkCategoryAssign}
                    disabled={!bulkCategoryTarget}
                    className="px-3 py-1.5 bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Apply
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Bulk Delete
                  </button>
                </div>
              )}
            </div>

            {/* PRODUCTS TABLE */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          onChange={handleSelectAllProducts}
                          checked={
                            filteredProducts.length > 0 &&
                            selectedProductIds.length === filteredProducts.length
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Product Details</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Special Deal Tags</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Quick Stock</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map((p) => {
                      const isLowStock = (p.stock || 0) < 5;
                      const isSelected = selectedProductIds.includes(p._id);

                      return (
                        <tr key={p._id} className={`hover:bg-gray-50/50 transition ${isSelected ? 'bg-blue-50/30' : ''}`}>
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectProduct(p._id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.images?.[0] || p.image || 'https://via.placeholder.com/150'}
                                alt={p.title}
                                className="w-10 h-10 object-contain bg-gray-50 border border-gray-200 rounded-lg p-0.5 shrink-0"
                              />
                              <div>
                                <span className="font-bold text-gray-900 block truncate max-w-xs">{p.title}</span>
                                <span className="text-[11px] text-gray-400">ID: {p._id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-gray-700">{p.category}</td>

                          {/* Deal Tags Badges Column */}
                          <td className="p-4">
                            <div className="flex items-center gap-1 flex-wrap max-w-xs">
                              {p.dealTags && p.dealTags.length > 0 ? (
                                p.dealTags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 font-bold text-[10px] rounded-md inline-flex items-center gap-1"
                                  >
                                    <Zap size={10} className="fill-orange-500" />
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-gray-400">Regular Item</span>
                              )}
                            </div>
                          </td>

                          <td className="p-4 font-bold text-gray-900">${Number(p.price).toFixed(2)}</td>

                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdjustStock(p._id, -1)}
                                className="p-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>
                              <span className={`font-black min-w-6 text-center ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                                {p.stock || 0}
                              </span>
                              <button
                                onClick={() => handleAdjustStock(p._id, 1)}
                                className="p-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>

                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:text-blue-600 hover:border-blue-600 transition cursor-pointer"
                              title="Edit Product"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => setProductToDelete(p)}
                              className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:text-red-600 hover:border-red-600 transition cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order Fulfillment Tracker</h1>
              <p className="text-xs text-gray-500 mt-0.5">Update shipment status and inspect customer order items.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Fulfillment Status</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="p-4 font-bold text-blue-600">{o.id}</td>
                      <td className="p-4 font-bold text-gray-900">{o.customer}</td>
                      <td className="p-4 text-gray-500">{o.date}</td>
                      <td className="p-4 font-bold text-gray-900">${o.total.toFixed(2)}</td>
                      <td className="p-4">
                        <select
                          value={o.status}
                          onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold outline-none border border-gray-200 bg-gray-50 cursor-pointer"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Processing">Processing</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setViewingOrder(o)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Eye size={13} /> View Items
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === 'categories' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Category Management</h1>
              <p className="text-xs text-gray-500 mt-0.5">Add or remove active storefront categories.</p>
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="New Category Name..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-blue-600 transition"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Add Category
              </button>
            </form>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-2">
              {categories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-800">
                  <span>{cat}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-gray-400 hover:text-red-600 transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BANNERS TAB */}
        {activeTab === 'banners' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Storefront Banners & Ticker</h1>
              <p className="text-xs text-gray-500 mt-0.5">Customize global promo marquee text and hero section banners.</p>
            </div>

            <form onSubmit={handleSaveBanner} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Top Announcement Marquee Ticker</label>
                <input
                  type="text"
                  value={storeBanner.announcementText}
                  onChange={(e) => setStoreBanner({ ...storeBanner, announcementText: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Hero Banner Main Heading</label>
                <input
                  type="text"
                  value={storeBanner.heroHeading}
                  onChange={(e) => setStoreBanner({ ...storeBanner, heroHeading: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Hero Banner Subheading</label>
                <input
                  type="text"
                  value={storeBanner.heroSubheading}
                  onChange={(e) => setStoreBanner({ ...storeBanner, heroSubheading: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  Save Banner Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* COUPONS TAB */}
        {activeTab === 'coupons' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Promo Code & Discount Generator</h1>
              <p className="text-xs text-gray-500 mt-0.5">Create checkout promo codes with custom percentage/fixed discounts.</p>
            </div>

            <form onSubmit={handleCreateCoupon} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHOP20"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Discount Type</label>
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white font-bold"
                >
                  <option value="Percentage">Percentage (%)</option>
                  <option value="Fixed ($)">Fixed ($)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Value</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 20"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer"
              >
                Create Coupon
              </button>
            </form>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Code</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Value</th>
                    <th className="p-4">Total Uses</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coupons.map((c, idx) => (
                    <tr key={idx}>
                      <td className="p-4 font-black text-gray-900 tracking-wider">{c.code}</td>
                      <td className="p-4 font-bold text-gray-600">{c.type}</td>
                      <td className="p-4 font-bold text-emerald-600">
                        {c.type === 'Percentage' ? `${c.value}%` : `$${c.value}`}
                      </td>
                      <td className="p-4 font-bold text-gray-700">{c.uses} redemptions</td>
                      <td className="p-4">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Activity Audit Log</h1>
              <p className="text-xs text-gray-500 mt-0.5">Chronological record of stock edits, status updates, and deletions.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs divide-y divide-gray-100">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-gray-900 block">{log.action}</span>
                    <span className="text-[11px] text-gray-400">By {log.user}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD / EDIT PRODUCT WITH DEAL TAG CLASSIFICATIONS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {editingProduct ? 'Edit Product Details' : 'Add New Product'}
              </h2>
              <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              {/* SPECIAL DEAL TAG CLASSIFICATIONS */}
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <label className="font-bold text-gray-700 flex items-center gap-1.5">
                  <Tag size={14} className="text-orange-500" />
                  <span>Special Deal Classification Tags</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEAL_TAG_OPTIONS.map((tag, idx) => {
                    const isChecked = productForm.dealTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleToggleDealTag(tag)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-orange-500 border-orange-500 text-white shadow-xs'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Zap size={12} className={isChecked ? 'fill-white' : 'text-gray-400'} />
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Original Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.originalPrice}
                    onChange={(e) => setProductForm({ ...productForm, originalPrice: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition font-bold"
                >
                  {categories.map((c, idx) => (
                    <option key={idx} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* COLOR VARIANTS SECTION */}
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700 flex items-center gap-1.5">
                    <Palette size={14} className="text-blue-600" />
                    <span>Product Color Variants</span>
                  </label>
                  <span className="text-[11px] text-gray-400">{productForm.colors.length} added</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Color name (e.g. Matte Black)"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                  />

                  <div className="flex items-center gap-1.5 px-2 bg-gray-50 border border-gray-200 rounded-xl">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded"
                    />
                    <span className="text-[11px] font-mono text-gray-500 uppercase font-bold">{newColorHex}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddColorVariant}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {productForm.colors.map((col, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block shadow-2xs"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span>{col.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveColorVariant(idx)}
                        className="text-gray-400 hover:text-red-500 transition cursor-pointer ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Image URLs</label>
                {productForm.images.map((imgUrl, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={imgUrl}
                      onChange={(e) => {
                        const updated = [...productForm.images];
                        updated[idx] = e.target.value;
                        setProductForm({ ...productForm, images: updated });
                      }}
                      className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-600 transition"
                    />
                    {productForm.images.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = productForm.images.filter((_, i) => i !== idx);
                          setProductForm({ ...productForm, images: updated });
                        }}
                        className="px-2 text-red-500 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setProductForm({ ...productForm, images: [...productForm.images, ''] })}
                  className="text-blue-600 font-bold hover:underline"
                >
                  + Add image URL
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Confirm Deletion</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-gray-900">"{productToDelete.title}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: ORDER INSPECTOR */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase">Order Details</h2>
                  <span className="text-xs font-bold text-blue-600">{viewingOrder.id}</span>
                </div>
                <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-400 block">Customer Name & Email</span>
                  <strong className="text-gray-900">{viewingOrder.customer}</strong>
                  <span className="text-gray-500 block">{viewingOrder.email}</span>
                </div>

                <div>
                  <span className="text-gray-400 block">Shipping Address</span>
                  <p className="text-gray-800 leading-relaxed">{viewingOrder.address}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-3">
                <span className="text-xs font-bold uppercase text-gray-500">Purchased Items</span>
                {viewingOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs flex justify-between">
                    <div>
                      <strong className="text-gray-900 block">{item.title}</strong>
                      <span className="text-gray-400 text-[11px]">Qty: {item.qty} | Variant: {item.size}, {item.color}</span>
                    </div>
                    <span className="font-bold text-gray-900">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold">
              <span>Order Total:</span>
              <span className="text-lg font-black text-gray-900">${viewingOrder.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}