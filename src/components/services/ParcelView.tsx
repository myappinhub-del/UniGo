import React, { useMemo, useState } from 'react';
import { ArrowLeft, Box, PackageCheck, ShieldCheck } from 'lucide-react';
import { AddressEntry, UserProfile } from '../../types/unigo';
import { DEFAULT_LOCATIONS } from '../../data/seedCatalog';
import { GoogleMapsView } from '../GoogleMapsView';
import { PlaceAutocompleteInput, computeHaversineKm } from '../PlaceAutocompleteInput';
import { PaymentGatewayModal } from '../PaymentGatewayModal';
import { createOrderWithDispatch } from '../../lib/unigoDb';

interface ParcelViewProps {
  mapsApiKey: string;
  user: UserProfile | null;
  currentLocation: AddressEntry;
  onRequireAuth: () => void;
  onBooked: (orderId: string) => void;
  onBackHome: () => void;
}

const WEIGHT_TIERS = [
  { label: 'Up to 1 kg (Envelope / Keys)', fee: 20 },
  { label: '1 - 5 kg (Box / Groceries)', fee: 45 },
  { label: '5 - 15 kg (Appliance / Luggage)', fee: 95 },
];

const PARCEL_TYPES = ['Documents', 'Electronics', 'Home Food Box', 'Fragile Glassware'];

export const ParcelView: React.FC<ParcelViewProps> = ({
  mapsApiKey,
  user,
  currentLocation,
  onRequireAuth,
  onBooked,
  onBackHome,
}) => {
  const [pickupAddr, setPickupAddr] = useState(currentLocation.fullAddress);
  const [pickupCoord, setPickupCoord] = useState({
    lat: currentLocation.lat,
    lng: currentLocation.lng,
  });

  const defaultDrop = DEFAULT_LOCATIONS[2];
  const [dropAddr, setDropAddr] = useState(defaultDrop.fullAddress);
  const [dropCoord, setDropCoord] = useState({
    lat: defaultDrop.lat,
    lng: defaultDrop.lng,
  });

  const [weightIdx, setWeightIdx] = useState(0);
  const [parcelType, setParcelType] = useState(PARCEL_TYPES[0]);
  const [receiverName, setReceiverName] = useState('');
  const [routeDistKm, setRouteDistKm] = useState<number | null>(null);
  const [payOpen, setPayOpen] = useState(false);

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

  const weightTier = WEIGHT_TIERS[weightIdx];
  const deliveryCharge = Math.round(35 + effectiveDist * 11 + weightTier.fee);

  const handlePaymentSuccess = async (paymentMethod: string, paymentStatus: 'paid' | 'cod') => {
    if (!user) return;
    const orderId = await createOrderWithDispatch({
      user,
      vertical: 'parcel',
      subtotal: deliveryCharge,
      deliveryFee: 0,
      platformFee: 5,
      tax: Math.round(deliveryCharge * 0.05),
      total: deliveryCharge + 5 + Math.round(deliveryCharge * 0.05),
      paymentMethod,
      paymentStatus,
      pickupAddress: pickupAddr,
      deliveryAddress: dropAddr,
      pickupCoords: pickupCoord,
      deliveryCoords: dropCoord,
      distanceKm: effectiveDist,
      notes: `${parcelType} · ${weightTier.label}${
        receiverName.trim() ? ` · Receiver: ${receiverName.trim()}` : ''
      }`,
    });
    setPayOpen(false);
    onBooked(orderId);
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
            UniGo Parcel Express
          </h1>
          <p className="text-xs text-neutral-500">
            Same-hour intra-city courier pickup with live route tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6">
          <GoogleMapsView
            apiKey={mapsApiKey}
            origin={pickupCoord}
            destination={dropCoord}
            travelMode="TWO_WHEELER"
            heightClass="h-72 md:h-96"
            onRouteComputed={(km) => setRouteDistKm(km)}
          />
        </div>

        <div className="lg:col-span-6 bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Pickup Address
              </label>
              <PlaceAutocompleteInput
                value={pickupAddr}
                onChange={setPickupAddr}
                placeholder="Where should rider collect?"
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
                Drop Address
              </label>
              <PlaceAutocompleteInput
                value={dropAddr}
                onChange={setDropAddr}
                placeholder="Where should parcel be delivered?"
                presets={presets}
                onPlaceSelected={(p) => {
                  setDropAddr(p.address);
                  setDropCoord({ lat: p.lat, lng: p.lng });
                  setRouteDistKm(null);
                }}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-[#222222] mb-2">Package Category</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PARCEL_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setParcelType(pt)}
                  className={`py-2 px-2.5 rounded-lg border text-[11px] font-semibold ${
                    parcelType === pt
                      ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                      : 'border-neutral-200 text-[#222222]'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-[#222222] mb-2">Weight Slab</div>
            <div className="space-y-1.5">
              {WEIGHT_TIERS.map((wt, idx) => (
                <button
                  key={wt.label}
                  type="button"
                  onClick={() => setWeightIdx(idx)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between ${
                    weightIdx === idx
                      ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                      : 'border-neutral-200 text-[#222222]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Box className="w-3.5 h-3.5" />
                    {wt.label}
                  </span>
                  <span className="tabular-nums">+₹{wt.fee}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#222222] mb-1">
              Recipient Name (optional)
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="e.g., Arjun Mehta"
              className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A]"
            />
          </div>

          <div className="bg-[#F5F6F7] rounded-xl p-3.5 flex items-center justify-between text-xs tabular-nums">
            <span className="text-neutral-600 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-[#16A34A]" />
              Estimated Route: <strong className="text-[#222222]">{effectiveDist} km</strong>
            </span>
            <span className="text-sm font-extrabold text-[#222222]">
              Total ₹{deliveryCharge + 5 + Math.round(deliveryCharge * 0.05)}
            </span>
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
            className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Book Parcel Pickup</span>
          </button>
        </div>
      </div>

      <PaymentGatewayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={deliveryCharge + 5 + Math.round(deliveryCharge * 0.05)}
        title="Pay for UniGo Parcel Express"
        walletBalance={user?.walletBalance ?? 0}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
