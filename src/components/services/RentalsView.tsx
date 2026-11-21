import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Home, Star, X } from 'lucide-react';
import { AddressEntry, CatalogItem, UserProfile } from '../../types/unigo';
import { SafeImage } from '../SafeImage';
import { createOrderWithDispatch } from '../../lib/unigoDb';

interface RentalsViewProps {
  catalog: CatalogItem[];
  user: UserProfile | null;
  currentLocation: AddressEntry;
  onRequireAuth: () => void;
  onEnquirySubmitted: (orderId: string) => void;
  onBackHome: () => void;
}

export const RentalsView: React.FC<RentalsViewProps> = ({
  catalog,
  user,
  currentLocation,
  onRequireAuth,
  onEnquirySubmitted,
  onBackHome,
}) => {
  const rentals = useMemo(
    () => catalog.filter((i) => i.vertical === 'rental'),
    [catalog]
  );

  const [tab, setTab] = useState<'All' | 'Property' | 'Vehicle'>('All');
  const [enquiringItem, setEnquiringItem] = useState<CatalogItem | null>(null);
  const [visitDate, setVisitDate] = useState('This Weekend · 11:00 AM');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (tab === 'All') return rentals;
    return rentals.filter((r) => r.category === tab);
  }, [rentals, tab]);

  const handleSubmitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!enquiringItem) return;
    setSubmitting(true);
    try {
      const orderId = await createOrderWithDispatch({
        user,
        vertical: 'rental',
        items: [
          {
            itemId: enquiringItem.id,
            title: enquiringItem.title,
            quantity: 1,
            price: enquiringItem.price,
            customization: visitDate,
          },
        ],
        subtotal: enquiringItem.price,
        total: enquiringItem.price,
        paymentMethod: 'Enquiry (Zero Booking Fee)',
        paymentStatus: 'pending',
        pickupAddress: enquiringItem.title,
        deliveryAddress: currentLocation.fullAddress,
        pickupCoords: {
          lat: Number((currentLocation.lat + 0.015).toFixed(6)),
          lng: Number((currentLocation.lng + 0.008).toFixed(6)),
        },
        deliveryCoords: {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        },
        scheduledSlot: visitDate,
        notes: notes.trim() || 'Interested in rental inspection / booking.',
      });
      setEnquiringItem(null);
      setNotes('');
      onEnquirySubmitted(orderId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              UniGo Rentals
            </h1>
            <p className="text-xs text-neutral-500">
              Verified apartments & self-drive EV scooters or cars with zero brokerage
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['All', 'Property', 'Vehicle'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
                tab === t
                  ? 'bg-[#222222] text-white border-[#222222]'
                  : 'bg-[#F5F6F7] text-[#222222] border-neutral-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col sm:flex-row"
          >
            <div className="sm:w-52 h-48 sm:h-auto bg-[#F5F6F7] shrink-0">
              <SafeImage
                src={item.imageUrl}
                alt={item.title}
                vertical={item.category === 'Vehicle' ? 'bike' : 'rental'}
              />
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>{item.category}</span>
                  <span className="font-bold text-[#16A34A] flex items-center gap-0.5 tabular-nums">
                    <Star className="w-3 h-3 fill-[#16A34A]" />
                    {item.rating.toFixed(1)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#222222] mt-1">
                  {item.title}
                </h3>
                <p className="text-xs text-neutral-600 mt-1">{item.subtitle}</p>
                {item.specs && (
                  <div className="mt-2.5 space-y-1">
                    {item.specs.map((sp, i) => (
                      <div key={i} className="text-[11px] text-neutral-600 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] mt-0.5 shrink-0" />
                        <span>{sp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-[#222222] tabular-nums">
                  {item.unitLabel}
                </div>
                <button
                  type="button"
                  onClick={() => setEnquiringItem(item)}
                  className="px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shrink-0"
                >
                  Enquire / Visit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {enquiringItem && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitEnquiry}
            className="bg-white rounded-2xl max-w-md w-full p-5 border border-neutral-200 shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-[#16A34A]" />
                <h3 className="text-base font-bold text-[#222222]">
                  Rental Enquiry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEnquiringItem(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F5F6F7] p-3 rounded-xl">
              <div className="text-sm font-bold text-[#222222]">
                {enquiringItem.title}
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                {enquiringItem.unitLabel}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Preferred Visit / Pickup Slot
              </label>
              <select
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#16A34A]"
              >
                <option>Today · 05:00 PM</option>
                <option>Tomorrow · 11:00 AM</option>
                <option>This Weekend · 11:00 AM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Message for Owner / Fleet Hub
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share move-in date, rental duration, or questions..."
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#16A34A]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold disabled:opacity-60"
            >
              {submitting ? 'Submitting Enquiry...' : 'Submit Verified Enquiry'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
