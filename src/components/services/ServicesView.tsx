import React, { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Star, X } from 'lucide-react';
import { AddressEntry, CatalogItem, UserProfile } from '../../types/unigo';
import { SafeImage } from '../SafeImage';
import { PaymentGatewayModal } from '../PaymentGatewayModal';
import { createOrderWithDispatch } from '../../lib/unigoDb';

interface ServicesViewProps {
  catalog: CatalogItem[];
  user: UserProfile | null;
  currentLocation: AddressEntry;
  initialServiceId?: string;
  onRequireAuth: () => void;
  onBooked: (orderId: string) => void;
  onBackHome: () => void;
}

const SLOTS = [
  'Today · 02:00 PM - 03:00 PM',
  'Today · 05:00 PM - 06:00 PM',
  'Tomorrow · 10:00 AM - 11:00 AM',
  'Tomorrow · 01:00 PM - 02:00 PM',
];

export const ServicesView: React.FC<ServicesViewProps> = ({
  catalog,
  user,
  currentLocation,
  initialServiceId,
  onRequireAuth,
  onBooked,
  onBackHome,
}) => {
  const services = useMemo(
    () => catalog.filter((i) => i.vertical === 'service'),
    [catalog]
  );

  const [selectedService, setSelectedService] = useState<CatalogItem | null>(
    () => services.find((s) => s.id === initialServiceId) || null
  );
  const [selectedSlot, setSelectedSlot] = useState(SLOTS[0]);
  const [notes, setNotes] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  const handlePaymentSuccess = async (paymentMethod: string, paymentStatus: 'paid' | 'cod') => {
    if (!user || !selectedService) return;
    const tax = Math.round(selectedService.price * 0.05);
    const total = selectedService.price + tax;
    const orderId = await createOrderWithDispatch({
      user,
      vertical: 'service',
      items: [
        {
          itemId: selectedService.id,
          title: selectedService.title,
          quantity: 1,
          price: selectedService.price,
          customization: selectedSlot,
        },
      ],
      subtotal: selectedService.price,
      deliveryFee: 0,
      platformFee: 0,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      pickupAddress: `${selectedService.category} Partner Hub`,
      deliveryAddress: currentLocation.fullAddress,
      pickupCoords: {
        lat: Number((currentLocation.lat + 0.014).toFixed(6)),
        lng: Number((currentLocation.lng - 0.01).toFixed(6)),
      },
      deliveryCoords: {
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      },
      scheduledSlot: selectedSlot,
      notes: notes.trim() || undefined,
    });
    setPayOpen(false);
    setSelectedService(null);
    onBooked(orderId);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="w-9 h-9 rounded-lg border border-neutral-200 bg-white flex items-center justify-center hover:bg-[#F5F6F7]"
        >
          <ArrowLeft className="w-4 h-4 text-[#222222]" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-[#222222]">
            Verified Home Services
          </h1>
          <p className="text-xs text-neutral-500">
            Background-checked professionals · Transparent rates · 30-day warranty
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {services.map((srv) => (
          <div
            key={srv.id}
            className="bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[4/3] bg-[#F5F6F7]">
                <SafeImage src={srv.imageUrl} alt={srv.title} vertical="service" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{srv.category}</span>
                  <span className="font-bold text-[#16A34A] flex items-center gap-1 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-[#16A34A]" />
                    {srv.rating.toFixed(1)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#222222] mt-1">
                  {srv.title}
                </h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  {srv.subtitle}
                </p>

                {srv.specs && (
                  <div className="mt-3 space-y-1.5">
                    {srv.specs.map((sp, i) => (
                      <div key={i} className="text-[11px] text-neutral-600 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] mt-0.5 shrink-0" />
                        <span>{sp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div className="tabular-nums">
                <span className="text-lg font-extrabold text-[#222222]">
                  ₹{srv.price.toLocaleString('en-IN')}
                </span>
                <div className="text-[11px] text-neutral-500">{srv.unitLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedService(srv)}
                className="px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors"
              >
                Book Appointment
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Appointment Scheduler Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-neutral-200 shadow-xl">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-[#222222]">
                  Schedule {selectedService.title}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  At {currentLocation.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              <div>
                <div className="text-xs font-bold text-[#222222] mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Select Arrival Window</span>
                </div>
                <div className="space-y-2">
                  {SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`w-full p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center gap-2 ${
                        selectedSlot === slot
                          ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                          : 'border-neutral-200 text-[#222222]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{slot}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#222222] mb-1">
                  Instructions for technician (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Gate code 402, bring ladder"
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onRequireAuth();
                  return;
                }
                setPayOpen(true);
              }}
              className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold tabular-nums"
            >
              Proceed to Pay · ₹
              {(selectedService.price + Math.round(selectedService.price * 0.05)).toLocaleString(
                'en-IN'
              )}
            </button>
          </div>
        </div>
      )}

      {selectedService && (
        <PaymentGatewayModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          amount={selectedService.price + Math.round(selectedService.price * 0.05)}
          title={selectedService.title}
          walletBalance={user?.walletBalance ?? 0}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};
