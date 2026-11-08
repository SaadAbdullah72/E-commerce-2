import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Package, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/hooks/useAuth';

const FIELD_CLASS =
  'w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-700 cursor-not-allowed';

const FIELD_ICON_CLASS = FIELD_CLASS.replace('px-3.5', 'pl-9 pr-3.5');

// Read-only for now: saving profile edits comes with the profile/orders phase (R6).
export default function ProfilePage({ onLogout }) {
  const navigate = useNavigate();
  const { user, account } = useAuth();

  const formData = {
    name: account?.fullName || 'Customer',
    email: user?.email || '',
    phone: account?.phone || '',
    address: '',
    city: '',
    zipCode: '',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Header Bar - Mobile Friendly Flex-Col to Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Account Settings</h1>
            <p className="text-xs text-gray-500 mt-1">Manage your personal details, default shipping address, and order tracking.</p>
          </div>
          
          <button
            onClick={async () => {
              if (onLogout) await onLogout();
              navigate('/login');
            }}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* User Sidebar Summary & Navigation */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-xs">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl mx-auto mb-3 border border-blue-100">
                {formData.name ? formData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
              </div>
              <h2 className="text-base font-bold text-gray-900">{formData.name || 'User'}</h2>
              <p className="text-xs text-gray-500 mt-0.5 break-all">{formData.email}</p>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <ShieldCheck size={14} />
                <span>Verified Account</span>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-xs space-y-1">
              <Link
                to="/orders"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-blue-50/60 text-gray-700 hover:text-blue-600 text-xs font-bold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Package size={16} className="text-blue-600" />
                  <span>My Orders & Tracking</span>
                </div>
                <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">2 Active</span>
              </Link>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">
                <div className="flex items-center gap-2.5">
                  <User size={16} />
                  <span>Personal Details</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Form Content */}
          <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <p role="status" className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-medium text-blue-700">
              Editing your details is coming soon. For now this page is read-only.
            </p>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              
              {/* Personal Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <User size={18} className="text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Personal Information</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      disabled
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Mail size={16} />
                      </span>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        disabled
                          className={FIELD_ICON_CLASS}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Phone size={16} />
                      </span>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        disabled
                          className={FIELD_ICON_CLASS}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Default Address Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <MapPin size={18} className="text-orange-500" />
                  <h2 className="text-sm font-bold text-gray-900">Default Shipping Address</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      disabled
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      disabled
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      disabled
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  );
}