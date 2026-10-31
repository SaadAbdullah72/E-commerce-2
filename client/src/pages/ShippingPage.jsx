import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';

const NIGERIAN_STATES = [
  'Abia State', 'Adamawa State', 'Akwa Ibom State', 'Anambra State',
  'Bauchi State (Primary Local Hub)', 'Bayelsa State', 'Benue State', 'Borno State',
  'Cross River State', 'Delta State', 'Ebonyi State', 'Edo State', 'Ekiti State',
  'Enugu State', 'Federal Capital Territory (FCT / Abuja)', 'Gombe State',
  'Imo State', 'Jigawa State', 'Kaduna State', 'Kano State', 'Katsina State',
  'Kebbi State', 'Kogi State', 'Kwara State', 'Lagos State', 'Nasarawa State',
  'Niger State', 'Ogun State', 'Ondo State', 'Osun State', 'Oyo State',
  'Plateau State', 'Rivers State', 'Sokoto State', 'Taraba State', 'Yobe State', 'Zamfara State',
];

const BAUCHI_CITIES = [
  'Bauchi (Metropolis)', 'Azare', 'Misau', "Jama'are", 'Katagum', 'Ningi',
  'Dass', 'Toro', 'Alkaleri', 'Bogoro', 'Tafawa Balewa', 'Darazo', 'Gamawa',
  'Giade', 'Itas/Gadau', 'Shira', 'Warji', 'Zaki', 'Kirfi', 'Damban',
];

const STANDARD_CITIES = ['City Central / Metropolis', 'Capital District', 'Commercial Area', 'Outer Region'];

const STANDARD_COURIERS = [
  'Shipbubble (1-3 Business Days (Nationwide))',
  'T-Ship (1-3 Business Days (Nationwide))',
  'GIG Logistics (Shipbubble) (1-3 Business Days (Nationwide))',
  'DHL Express Nigeria (Shipbubble) (24-48 Hours Priority Air)',
  'Fez Delivery (Shipbubble) (Same / Next Day (Nationwide))',
  'Red Star Express / FedEx (Shipbubble) (2-4 Business Days (Nationwide))',
  'T-Ship Express Courier (Terminal Africa) (1-2 Days Priority Courier)',
  'T-Ship Standard Freight (Terminal Africa) (2-4 Days Nationwide Freight)',
];

const BAUCHI_EXCLUSIVE_COURIER = 'ShopYaro Express Delivery (Bauchi Local Only) (Same Day / 24 Hours (Bauchi State Only))';

export default function ShippingPage({ onProceedToPayment }) {
  const navigate = useNavigate();
  const { cart, totalPrice } = useCart();

  const [formData, setFormData] = useState({
    fullName: 'Huzaifa Javid',
    email: 'huzaifa@gmail.com',
    phone: '+234 800 1234567',
    address: 'F Block B-17',
    state: '',
    city: '',
    courier: '',
    notes: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') {
      const isNowBauchi = value === 'Bauchi State (Primary Local Hub)';
      setFormData({ 
        ...formData, 
        state: value, 
        city: '', 
        courier: isNowBauchi ? BAUCHI_EXCLUSIVE_COURIER : '' 
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDeliveryFee = formData.state === 'Bauchi State (Primary Local Hub)' ? 0 : 4800;
    const finalPayload = { ...formData, deliveryFee: finalDeliveryFee };

    // Save directly to localStorage as an instant fallback
    localStorage.setItem('shopyaro_shipping', JSON.stringify(finalPayload));

    if (onProceedToPayment) {
      onProceedToPayment(finalPayload);
    } else {
      // Pass the payload directly through navigate state
      navigate('/checkout', { state: { shippingData: finalPayload } });
    }
  };

  const isBauchiState = formData.state === 'Bauchi State (Primary Local Hub)';
  const availableCities = formData.state ? (isBauchiState ? BAUCHI_CITIES : STANDARD_CITIES) : [];
  const availableCouriers = isBauchiState ? [BAUCHI_EXCLUSIVE_COURIER, ...STANDARD_COURIERS] : STANDARD_COURIERS;

  const deliveryFee = isBauchiState ? 0 : 4800;
  const grandTotal = totalPrice + deliveryFee;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-blue-600">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">1</span>
            <span>Shipping</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">2</span>
            <span>Payment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100 mb-6">
              <MapPin size={20} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Shipping Destination</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">State *</label>
                  <select
                    name="state"
                    required
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {NIGERIAN_STATES.map((st, idx) => (
                      <option key={idx} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">City *</label>
                  <select
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleChange}
                    disabled={!formData.state}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer disabled:opacity-60"
                  >
                    <option value="">
                      {formData.state ? 'Select City' : 'Select State First'}
                    </option>
                    {availableCities.map((ct, idx) => (
                      <option key={idx} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isBauchiState && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800[cite: 12]">
                  <Truck size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    <strong>Bauchi Metropolis Resident:</strong> Enjoy <strong>100% FREE Delivery (₦0.00)</strong> across all categories[cite: 12].
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Delivery Courier *</label>
                <select
                  name="courier"
                  required
                  value={formData.courier}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="">Select Courier</option>
                  {availableCouriers.map((c, idx) => (
                    <option key={idx} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  name="notes"
                  placeholder="Special instructions"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 mt-6 cursor-pointer"
              >
                Proceed to Payment <ArrowRight size={14} />
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 pb-3 border-b border-gray-100">Order Summary</h3>
            <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">₦{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery Fee</span>
                <span className={`font-bold ${isBauchiState ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {isBauchiState ? '₦0.00 (FREE)' : '₦4,800.00'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-100">
                <span>Total Amount</span>
                <span className="text-blue-600">₦{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}