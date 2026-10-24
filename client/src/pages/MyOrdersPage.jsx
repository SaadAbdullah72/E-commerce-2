import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ShoppingBag
} from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [expandedOrder, setExpandedOrder] = useState('SY-89421');
  const [copiedId, setCopiedId] = useState(null);

  const orders = [
    {
      id: 'SY-89421',
      date: 'October 24, 2026',
      total: 32.49,
      status: 'In Transit',
      currentStep: 3,
      trackingNumber: 'TRK-90281472',
      courier: 'Leopard Express',
      estimatedDelivery: 'Oct 26, 2026',
      items: [
        {
          _id: 'prod_1',
          title: 'Wireless Bluetooth Earbuds Noise Cancelling',
          price: 12.99,
          quantity: 1,
          variant: 'Matte Black',
          image: 'https://via.placeholder.com/150?text=Earbuds',
        },
        {
          _id: 'prod_2',
          title: 'Smart Waterproof Fitness Watch Tracker',
          price: 19.50,
          quantity: 1,
          variant: 'Silver Strap',
          image: 'https://via.placeholder.com/150?text=Smartwatch',
        },
      ],
    },
    {
      id: 'SY-76104',
      date: 'September 15, 2026',
      total: 16.99,
      status: 'Delivered',
      currentStep: 4,
      trackingNumber: 'TRK-44018293',
      courier: 'TCS Courier',
      estimatedDelivery: 'Sep 18, 2026',
      items: [
        {
          _id: 'prod_3',
          title: 'Portable USB Mini Blender for Smoothies',
          price: 16.99,
          quantity: 1,
          variant: 'Mint Green',
          image: 'https://via.placeholder.com/150?text=Blender',
        },
      ],
    },
  ];

  const steps = [
    { title: 'Order Placed', desc: 'Received and verified' },
    { title: 'Processing', desc: 'Packed at hub' },
    { title: 'In Transit', desc: 'On the way' },
    { title: 'Delivered', desc: 'Arrived at address' },
  ];

  const copyTracking = (num) => {
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">My Orders & Tracking</h1>
            <p className="text-xs text-gray-500 mt-1">Track live delivery status and view order history.</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            Continue Shopping
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden transition"
              >
                {/* Order Summary Header */}
                <div
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="p-5 bg-white flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 transition border-b border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className={`flex items-center justify-center shrink-0 ${
                      order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {/* <Package size={20} /> */}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{order.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          order.status === 'Delivered' 
                            ? 'bg-emerald-50 text-emerald-700 ' 
                            : 'bg-orange-50 text-orange-700 '
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 block mt-0.5">Placed on {order.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Total Amount</span>
                      <span className="text-sm font-bold text-gray-900">${order.total.toFixed(2)}</span>
                    </div>

                    <button className="text-gray-400 hover:text-gray-700 p-1">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 bg-gray-50/50 space-y-6">
                    
                    {/* Live Progress Tracker */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <Truck size={18} className="text-blue-600" />
                          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Live Delivery Tracker</h2>
                        </div>
                        <span className="text-xs text-gray-500">
                          Est. Delivery: <strong className="text-gray-900 font-bold">{order.estimatedDelivery}</strong>
                        </span>
                      </div>

                      {/* Timeline Bar */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
                        {steps.map((step, idx) => {
                          const stepNum = idx + 1;
                          const isCompleted = stepNum <= order.currentStep;
                          const isCurrent = stepNum === order.currentStep;

                          return (
                            <div key={idx} className="relative z-10 flex flex-col items-center text-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition mb-2 ${
                                isCompleted
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}>
                                {isCompleted ? <CheckCircle2 size={16} /> : stepNum}
                              </div>
                              <span className={`text-xs font-bold block ${isCurrent ? 'text-blue-600' : 'text-gray-800'}`}>
                                {step.title}
                              </span>
                              <span className="text-[11px] text-gray-500 mt-0.5">{step.desc}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Logistics Info */}
                      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>Courier: <strong className="text-gray-900">{order.courier}</strong></span>
                          <span>•</span>
                          <span>Tracking Number: <strong className="text-gray-900">{order.trackingNumber}</strong></span>
                        </div>

                        <button
                          onClick={() => copyTracking(order.trackingNumber)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold transition cursor-pointer"
                        >
                          <Copy size={13} /> {copiedId === order.trackingNumber ? 'Copied' : 'Copy Tracking'}
                        </button>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100 mb-4">
                        Items in Shipment ({order.items.length})
                      </h3>

                      <div className="space-y-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-4 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-12 h-12 object-contain bg-gray-50 border border-gray-200 rounded-xl p-1 shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-gray-900 truncate">{item.title}</h4>
                                {item.variant && <span className="text-[11px] text-gray-500 block">Variant: {item.variant}</span>}
                                <span className="text-xs text-gray-500">${item.price.toFixed(2)} x {item.quantity}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => addToCart(item, item.quantity)}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              Buy Again
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}