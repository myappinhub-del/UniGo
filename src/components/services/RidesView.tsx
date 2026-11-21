import React, { useMemo, useState } from 'react';
import { ArrowLeft, Bike, Car, Clock, Navigation, ShieldCheck, Truck } from 'lucide-react';
import { AddressEntry, OrderRecord, UserProfile } from '../../types/unigo';
import { DEFAULT_LOCATIONS } from '../../data/seedCatalog';
import { GoogleMapsView } from '../GoogleMapsView';
import { PlaceAutocompleteInput, computeHaversineKm } from '../PlaceAutocompleteInput';
import { PaymentGatewayModal } from '../PaymentGatewayModal';
import { createOrderWithDispatch } from '../../lib/unigoDb';

interface RidesViewProps {
  mapsApiKey: string;
  user: UserProfile | null;
  currentLocation: AddressEntry;
  initialTier: 'bike' | 'auto' | 'car';
  activeRideOrder?: OrderRecord;
  onRequireAuth: () => void;
  onOrderCreated: (orderId: string) => void;
  onBackHome: () => void;
}

const RIDE_TIERS = [
  {
    key: 'bike' as const,
    name: 'UniGo Bike',
    desc: 'Fastest solo commute through traffic · Helmet provided',
    baseFare: 22,
    perKm: 9,
    eta: 3,
    icon: Bike,
    mode: 'TWO_WHEELER' as const,
  },
  {
    key: 'auto' as const,
    name: 'UniGo Auto',
    desc: 'Doorstep metered auto · Up to 3 passengers',
    baseFare: 35,
    perKm: 14,
    eta: 4,
    icon: Truck,
    mode: 'DRIVING' as const,
  },
  {
    key: 'car' as const,
    name: 'Prime Sedan AC',
    desc: 'Comfortable AC sedan · Top-rated captain',
    baseFare: 65,
    perKm: 19,
    eta: 6,
    icon: Car,
    mode: 'DRIVING' as const,
  },
];

export const RidesView: React.FC<RidesViewProps> = ({
  mapsApiKey,
  user,
  currentLocation,
  initialTier,
  activeRideOrder,
  onRequireAuth,
  onOrderCreated,
  onBackHome,
}) => {
  const [pickupAddr, setPickupAddr] = useState(currentLocation.fullAddress);
  const [pickupCoord, setPickupCoord] = useState({
    lat: currentLocation.lat,
    lng: currentLocation.lng,
  });

  const defaultDrop = DEFAULT_LOCATIONS[1];
  const [dropAddr, setDropAddr] = useState(defaultDrop.fullAddress);
  const [dropCoord, setDropCoord] = useState({
    lat: defaultDrop.lat,
    lng: defaultDrop.lng,
  });

  const [selectedTier, setSelectedTier] = useState<'bike' | 'auto' | 'car'>(initialTier);
  const [routeDistKm, setRouteDistKm] = useState<number | null>(null);
  const [routeDurationMin, setRouteDurationMin] = useState<number | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const presets = DEFAULT_LOCATIONS.map((d) => ({
    label: d.label,
    address: d.fullAddress,
    lat: d.lat,
    lng: d.lng,
  }));

  const effectiveDist = useMemo(
    () => routeDistKm ?? computeHaversineKm(pickupCoord, dropCoord),
    [routeDistKm, pickupCoord, dropCoord]
  );

  const effectiveMins = useMemo(
    () => routeDurationMin ?? Math.max(8, Math.round(effectiveDist * 3.2)),
    [routeDurationMin, effectiveDist]
  );

  const activeTierObj = RIDE_TIERS.find((t) => t.key === selectedTier)!;
  const estimatedFare = Math.round(
    activeTierObj.baseFare + effectiveDist * activeTierObj.perKm
  );

  // Simulate partner position slightly offset from pickup while active
  const partnerMarkerPos = activeRideOrder
    ? {
        lat: pickupCoord.lat + 0.004,
        lng: pickupCoord.lng - 0.003,
      }
    : null;

  const handleConfirmPayment = async (paymentMethod: string, paymentStatus: 'paid' | 'cod') => {
    if (!user) return;
    setBookingError(null);
    const orderId = await createOrderWithDispatch({
      user,
      vertical: 'ride',
      subtotal: estimatedFare,
      deliveryFee: 0,
      platformFee: 5,
      tax: Math.round(estimatedFare * 0.05),
      total: estimatedFare + 5 + Math.round(estimatedFare * 0.05),
      paymentMethod,
      paymentStatus,
      pickupAddress: pickupAddr,
      deliveryAddress: dropAddr,
      pickupCoords: pickupCoord,
      deliveryCoords: dropCoord,
      distanceKm: effectiveDist,
      notes: `${activeTierObj.name} · Est ${effectiveMins} mins`,
    });
    setPayOpen(false);
    onOrderCreated(orderId);
  };

  return (
    <div className="space-y-5 pb-8">
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
            UniGo Rides
          </h1>
          <p className="text-xs text-neutral-500">
            Live Google Maps routing · Transparent INR fares · Instant captain tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-4">
          <GoogleMapsView
            apiKey={mapsApiKey}
            origin={pickupCoord}
            destination={dropCoord}
            partnerPosition={partnerMarkerPos}
            travelMode={activeTierObj.mode}
            heightClass="h-72 md:h-96"
            onRouteComputed={(km, mins) => {
              setRouteDistKm(km);
              setRouteDurationMin(mins);
            }}
          />

          {activeRideOrder && (
            <div className="bg-[#16A34A]/5 border border-[#16A34A]/30 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#16A34A]">
                  Active Ride {activeRideOrder.orderNumber} · {activeRideOrder.status.replace('_', ' ')}
                </div>
                <div className="text-xs text-[#222222] mt-1">
                  {activeRideOrder.partnerName
                    ? `Captain ${activeRideOrder.partnerName} is on the way`
                    : 'Broadcasting to nearby UniGo captains...'}
                </div>
              </div>
              <div className="text-sm font-extrabold text-[#222222] tabular-nums">
                ₹{activeRideOrder.total}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Pickup Location
              </label>
              <PlaceAutocompleteInput
                value={pickupAddr}
                onChange={setPickupAddr}
                placeholder="Enter pickup landmark or address"
                presets={presets}
                onPlaceSelected={(p) => {
                  setPickupAddr(p.address);
                  setPickupCoord({ lat: p.lat, lng: p.lng });
                  setRouteDistKm(null);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Drop Destination
              </label>
              <PlaceAutocompleteInput
                value={dropAddr}
                onChange={setDropAddr}
                placeholder="Where are you heading?"
                presets={presets}
                onPlaceSelected={(p) => {
                  setDropAddr(p.address);
                  setDropCoord({ lat: p.lat, lng: p.lng });
                  setRouteDistKm(null);
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-600 bg-[#F5F6F7] px-3.5 py-2.5 rounded-lg tabular-nums">
            <span className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[#16A34A]" />
              Distance: <strong className="text-[#222222]">{effectiveDist} km</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#16A34A]" />
              Est: <strong className="text-[#222222]">{effectiveMins} mins</strong>
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-[#222222]">Select Ride Tier</div>
            {RIDE_TIERS.map((tier) => {
              const Icon = tier.icon;
              const fare = Math.round(tier.baseFare + effectiveDist * tier.perKm);
              const active = selectedTier === tier.key;
              return (
                <button
                  key={tier.key}
                  type="button"
                  onClick={() => setSelectedTier(tier.key)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                    active
                      ? 'border-[#16A34A] bg-[#16A34A]/5'
                      : 'border-neutral-200 hover:bg-[#F5F6F7]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#F5F6F7] border border-neutral-200 flex items-center justify-center text-[#16A34A] shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#222222]">
                        {tier.name} · {tier.eta} min away
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {tier.desc}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-[#222222] tabular-nums shrink-0">
                    ₹{fare}
                  </div>
                </button>
              );
            })}
          </div>

          {bookingError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {bookingError}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!user) {
                onRequireAuth();
                return;
              }
              setPayOpen(true);
            }}
            className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold flex items-center justify-center gap-2 tabular-nums transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              Book {activeTierObj.name} · ₹
              {estimatedFare + 5 + Math.round(estimatedFare * 0.05)}
            </span>
          </button>
        </div>
      </div>

      <PaymentGatewayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={estimatedFare + 5 + Math.round(estimatedFare * 0.05)}
        title={`Pay for ${activeTierObj.name}`}
        walletBalance={user?.walletBalance ?? 0}
        onSuccess={handleConfirmPayment}
      />
    </div>
  );
};
