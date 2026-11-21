import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Power,
  Route as RouteIcon,
  Wallet,
  X,
} from 'lucide-react';
import {
  DispatchJobRecord,
  FranchiseZone,
  LatLngLiteral,
  OrderRecord,
  OrderStatus,
  PartnerProfile,
  UserProfile,
} from '../types/unigo';
import {
  acceptDispatchJob,
  partnerAdvanceOrder,
  upsertPartnerProfile,
} from '../lib/unigoDb';
import { ComputedDirectionsInfo, GoogleMapsView } from './GoogleMapsView';

interface PartnerPortalViewProps {
  user: UserProfile | null;
  partnerProfile: PartnerProfile | null;
  openJobs: DispatchJobRecord[];
  assignedOrders: OrderRecord[];
  mapsApiKey: string;
  zones?: FranchiseZone[];
  onRequireAuth: () => void;
}

interface NavTarget {
  orderNumber: string;
  vertical: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupCoords: LatLngLiteral;
  deliveryCoords: LatLngLiteral;
  notes?: string;
  customerName?: string;
}

function getFallbackCoordsForZone(
  zoneName: string,
  zones?: FranchiseZone[]
): LatLngLiteral {
  const key = zoneName.split(',')[0].trim().toLowerCase();
  const matched = zones?.find(
    (z) =>
      z.name.toLowerCase().includes(key) ||
      key.includes(z.name.toLowerCase().split(' ')[0])
  );
  if (matched?.centerLat && matched?.centerLng) {
    return { lat: matched.centerLat, lng: matched.centerLng };
  }
  return { lat: 12.9784, lng: 77.6408 };
}

export const PartnerPortalView: React.FC<PartnerPortalViewProps> = ({
  user,
  partnerProfile,
  openJobs,
  assignedOrders,
  mapsApiKey,
  zones = [],
  onRequireAuth,
}) => {
  const [name, setName] = useState(user?.displayName || 'UniGo Partner');
  const [phone, setPhone] = useState(user?.phone || '');
  const [vehicleType, setVehicleType] = useState<PartnerProfile['vehicleType']>(
    partnerProfile?.vehicleType || 'bike'
  );
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Delivery Boy GPS & Turn-by-Turn Directions State
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
  const [navLeg, setNavLeg] = useState<'to_customer' | 'to_pickup'>('to_customer');
  const [riderGps, setRiderGps] = useState<LatLngLiteral | null>(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [directionsInfo, setDirectionsInfo] = useState<ComputedDirectionsInfo | null>(
    null
  );

  const handleDirectionsReady = useCallback((info: ComputedDirectionsInfo) => {
    setDirectionsInfo(info);
  }, []);

  useEffect(() => {
    if (!gpsTracking) return;
    if (!navigator.geolocation) {
      setGpsError('Browser GPS geolocation is unavailable on this device.');
      setGpsTracking(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRiderGps({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGpsError(null);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? 'GPS permission denied — routing from Pickup Hub instead.'
            : 'GPS signal weak — routing from Pickup Hub coordinates.'
        );
        setGpsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsTracking]);

  const zoneHubFallback = useMemo(
    () =>
      getFallbackCoordsForZone(
        partnerProfile?.franchiseZone || user?.franchiseZone || 'Indiranagar',
        zones
      ),
    [partnerProfile?.franchiseZone, user?.franchiseZone, zones]
  );

  const activeNavOrigin: LatLngLiteral = useMemo(() => {
    if (!navTarget) return zoneHubFallback;
    if (navLeg === 'to_pickup') {
      return riderGps || {
        lat: Number((navTarget.pickupCoords.lat - 0.008).toFixed(6)),
        lng: Number((navTarget.pickupCoords.lng - 0.006).toFixed(6)),
      };
    }
    return riderGps || navTarget.pickupCoords;
  }, [navTarget, navLeg, riderGps, zoneHubFallback]);

  const activeNavDestination: LatLngLiteral | null = useMemo(() => {
    if (!navTarget) return null;
    return navLeg === 'to_pickup'
      ? navTarget.pickupCoords
      : navTarget.deliveryCoords;
  }, [navTarget, navLeg]);

  const externalMapsUrl = useMemo(() => {
    if (!navTarget || !activeNavDestination) return '#';
    const destText =
      navLeg === 'to_pickup'
        ? navTarget.pickupAddress
        : navTarget.deliveryAddress;
    const originParam = riderGps
      ? `${riderGps.lat},${riderGps.lng}`
      : `${activeNavOrigin.lat},${activeNavOrigin.lng}`;
    const destParam = `${activeNavDestination.lat},${activeNavDestination.lng}`;
    const travelMode =
      partnerProfile?.vehicleType === 'bike' ? 'two-wheeler' : 'driving';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      originParam
    )}&destination=${encodeURIComponent(
      destParam || destText
    )}&travelmode=${travelMode}`;
  }, [navTarget, navLeg, riderGps, activeNavOrigin, activeNavDestination, partnerProfile?.vehicleType]);

  if (!user) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-md mx-auto my-8">
        <Briefcase className="w-10 h-10 text-[#16A34A] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">UniGo Partner App</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-5">
          Sign in to go online, accept delivery/ride/service jobs, and navigate to customer locations.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold"
        >
          Sign In as Partner
        </button>
      </div>
    );
  }

  const handleRegisterOrToggle = async (nextOnline: boolean) => {
    setSavingProfile(true);
    try {
      await upsertPartnerProfile({
        uid: user.uid,
        name: partnerProfile?.name || name,
        vehicleType: partnerProfile?.vehicleType || vehicleType,
        phone: partnerProfile?.phone || phone,
        franchiseZone: user.franchiseZone || 'Indiranagar, Bengaluru',
        isOnline: nextOnline,
        existing: partnerProfile,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  if (!partnerProfile) {
    return (
      <div className="max-w-md mx-auto bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 my-6">
        <div>
          <h1 className="text-lg font-extrabold text-[#222222]">
            Activate Partner Profile
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Set up your rider, captain, or technician profile to receive live jobs in {user.franchiseZone}.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#222222] mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#222222] mb-1">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number"
            className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#222222] mb-1">
            Partner Category / Vehicle
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as PartnerProfile['vehicleType'])}
            className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
          >
            <option value="bike">Bike Delivery / Bike Taxi</option>
            <option value="auto">Auto Rickshaw Captain</option>
            <option value="car">Prime Sedan / Cab Captain</option>
            <option value="van">Parcel Van Courier</option>
            <option value="technician">Home Service Technician</option>
          </select>
        </div>

        <button
          type="button"
          disabled={savingProfile}
          onClick={() => handleRegisterOrToggle(true)}
          className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold"
        >
          {savingProfile ? 'Activating...' : 'Go Online & Start Accepting Jobs'}
        </button>
      </div>
    );
  }

  const activeJobs = assignedOrders.filter(
    (o) => !['delivered', 'completed', 'cancelled'].includes(o.status)
  );
  const pastJobs = assignedOrders.filter((o) =>
    ['delivered', 'completed'].includes(o.status)
  );

  const openNavigationForOrder = (order: OrderRecord) => {
    const pCoords = order.pickupCoords || {
      lat: Number((zoneHubFallback.lat + 0.008).toFixed(6)),
      lng: Number((zoneHubFallback.lng - 0.006).toFixed(6)),
    };
    const dCoords = order.deliveryCoords || zoneHubFallback;
    setDirectionsInfo(null);
    setNavLeg(order.status === 'confirmed' ? 'to_pickup' : 'to_customer');
    setNavTarget({
      orderNumber: order.orderNumber,
      vertical: order.vertical,
      pickupAddress: order.pickupAddress || `${order.franchiseZone} Pickup`,
      deliveryAddress: order.deliveryAddress || `${order.franchiseZone} Customer`,
      pickupCoords: pCoords,
      deliveryCoords: dCoords,
      notes: order.notes,
      customerName: order.userName,
    });
    if (!riderGps && navigator.geolocation) {
      setGpsTracking(true);
    }
  };

  const openNavigationForDispatch = (job: DispatchJobRecord) => {
    const pCoords = job.pickupCoords || {
      lat: Number((zoneHubFallback.lat + 0.008).toFixed(6)),
      lng: Number((zoneHubFallback.lng - 0.006).toFixed(6)),
    };
    const dCoords = job.deliveryCoords || zoneHubFallback;
    setDirectionsInfo(null);
    setNavLeg('to_customer');
    setNavTarget({
      orderNumber: job.orderNumber,
      vertical: job.vertical,
      pickupAddress: job.pickupArea,
      deliveryAddress: job.dropArea,
      pickupCoords: pCoords,
      deliveryCoords: dCoords,
    });
    if (!riderGps && navigator.geolocation) {
      setGpsTracking(true);
    }
  };

  const handleAccept = async (job: DispatchJobRecord) => {
    setBusyJobId(job.orderId);
    try {
      await acceptDispatchJob({ job, partner: partnerProfile });
    } finally {
      setBusyJobId(null);
    }
  };

  const handleAdvance = async (order: OrderRecord, nextStatus: OrderStatus) => {
    setBusyJobId(order.id);
    const payout = Math.max(35, Math.round(order.total * 0.14 + (order.deliveryFee ?? 25)));
    try {
      await partnerAdvanceOrder({
        order,
        nextStatus,
        partner: partnerProfile,
        payoutAmount: payout,
      });
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Partner Duty Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#16A34A]">
            Partner Console · {partnerProfile.vehicleType.toUpperCase()} · {partnerProfile.franchiseZone}
          </div>
          <h1 className="text-xl font-extrabold text-[#222222] mt-0.5">
            {partnerProfile.name}
          </h1>
          <div className="text-xs text-neutral-500 mt-1 tabular-nums">
            Rating {partnerProfile.rating.toFixed(1)} ★ · {partnerProfile.completedJobs} completed jobs
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setGpsTracking((p) => !p)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              gpsTracking || riderGps
                ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                : 'border-neutral-200 bg-[#F5F6F7] text-[#222222]'
            }`}
          >
            <LocateFixed className="w-4 h-4" />
            <span>
              {gpsTracking ? 'GPS Live' : riderGps ? 'GPS Locked' : 'Enable GPS'}
            </span>
          </button>

          <div className="px-4 py-2 rounded-xl bg-[#F5F6F7] border border-neutral-200 text-right tabular-nums">
            <div className="text-[11px] text-neutral-500 flex items-center gap-1 justify-end">
              <Wallet className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Earnings</span>
            </div>
            <div className="text-base font-extrabold text-[#222222]">
              ₹{partnerProfile.totalEarnings.toLocaleString('en-IN')}
            </div>
          </div>

          <button
            type="button"
            disabled={savingProfile}
            onClick={() => handleRegisterOrToggle(!partnerProfile.isOnline)}
            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              partnerProfile.isOnline
                ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                : 'bg-[#222222] text-white hover:bg-neutral-800'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{partnerProfile.isOnline ? 'Online · On Duty' : 'Offline · Go Online'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Delivery Boy Route & Turn-by-Turn Navigation Panel */}
      {navTarget && (
        <section className="bg-white border-2 border-[#16A34A] rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#16A34A] flex items-center gap-1.5 uppercase">
                <RouteIcon className="w-4 h-4" />
                <span>
                  Delivery Navigation · {navTarget.vertical} · {navTarget.orderNumber}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-[#222222] mt-0.5">
                {navLeg === 'to_customer'
                  ? `Heading to Customer Delivery${
                      navTarget.customerName ? ` (${navTarget.customerName})` : ''
                    }`
                  : 'Heading to Pickup Point'}
              </h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                {navLeg === 'to_customer'
                  ? navTarget.deliveryAddress
                  : navTarget.pickupAddress}
              </p>
              {navTarget.notes && (
                <p className="text-[11px] font-medium text-amber-700 mt-1">
                  Note: {navTarget.notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={externalMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>
              <button
                type="button"
                onClick={() => setNavTarget(null)}
                aria-label="Close navigation panel"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F6F7] border border-neutral-200 rounded-xl p-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDirectionsInfo(null);
                  setNavLeg('to_pickup');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  navLeg === 'to_pickup'
                    ? 'bg-[#222222] text-white'
                    : 'bg-white text-[#222222] border border-neutral-200'
                }`}
              >
                Step 1: Go to Pickup
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectionsInfo(null);
                  setNavLeg('to_customer');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  navLeg === 'to_customer'
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-white text-[#222222] border border-neutral-200'
                }`}
              >
                Step 2: Deliver to Customer
              </button>
            </div>

            {directionsInfo && (
              <div className="text-xs font-bold text-[#222222] tabular-nums px-2">
                {directionsInfo.distanceKm} km · Est {directionsInfo.durationMinutes} mins
              </div>
            )}
          </div>

          {gpsError && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {gpsError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7">
              <GoogleMapsView
                apiKey={mapsApiKey}
                origin={activeNavOrigin}
                destination={activeNavDestination}
                partnerPosition={riderGps}
                originLabel={
                  riderGps
                    ? 'Your GPS Location'
                    : navLeg === 'to_pickup'
                    ? 'Start Location'
                    : 'Pickup Store'
                }
                destinationLabel={
                  navLeg === 'to_pickup'
                    ? 'Pickup Location'
                    : 'Customer Delivery Location'
                }
                travelMode={
                  partnerProfile.vehicleType === 'bike'
                    ? 'TWO_WHEELER'
                    : 'DRIVING'
                }
                heightClass="h-72 md:h-80"
                onDirectionsReady={handleDirectionsReady}
              />
            </div>

            <div className="lg:col-span-5 bg-[#F5F6F7] border border-neutral-200 rounded-xl p-4 max-h-80 overflow-y-auto space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#222222]">
                  Turn-by-Turn Directions
                </h3>
                <span className="text-[11px] text-neutral-500">
                  {riderGps ? 'From Your GPS' : 'From Pickup'}
                </span>
              </div>

              {!directionsInfo || directionsInfo.steps.length === 0 ? (
                <div className="text-xs text-neutral-500 py-4 leading-relaxed">
                  {mapsApiKey
                    ? 'Computing live turn-by-turn steps via Google Routes...'
                    : 'Use "Open in Google Maps" above for live voice turn-by-turn navigation to the customer doorstep.'}
                </div>
              ) : (
                <ol className="space-y-2">
                  {directionsInfo.steps.map((st, idx) => (
                    <li
                      key={idx}
                      className="bg-white border border-neutral-200 rounded-lg p-2.5 text-xs flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-[#222222] leading-snug">
                          {st.instruction}
                        </span>
                      </div>
                      {st.distanceText && (
                        <span className="text-[11px] font-semibold text-neutral-500 shrink-0 tabular-nums">
                          {st.distanceText}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Active Assigned Jobs */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#222222]">
          Active Assigned Jobs ({activeJobs.length})
        </h2>

        {activeJobs.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 text-xs text-neutral-500">
            No active jobs right now. Accept an open dispatch request below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJobs.map((order) => {
              const nextStep: OrderStatus =
                order.status === 'confirmed'
                  ? 'preparing'
                  : order.status === 'preparing'
                  ? 'en_route'
                  : 'delivered';
              const nextLabel =
                order.status === 'confirmed'
                  ? 'Arrived at Pickup'
                  : order.status === 'preparing'
                  ? 'Start Trip / Out for Delivery'
                  : 'Complete & Collect';

              return (
                <div
                  key={order.id}
                  className="bg-white border-2 border-[#16A34A]/30 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#16A34A] uppercase">
                      {order.vertical} · {order.orderNumber}
                    </span>
                    <span className="text-xs font-semibold text-[#222222] capitalize">
                      Status: {order.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-neutral-600">
                    <div className="flex items-start gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-[#16A34A] mt-0.5 shrink-0" />
                      <span>
                        <strong>Pickup:</strong> {order.pickupAddress}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#222222] mt-0.5 shrink-0" />
                      <span>
                        <strong>Customer Drop:</strong> {order.deliveryAddress}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                    <span className="text-xs font-bold text-[#222222] tabular-nums">
                      Order Value ₹{order.total.toLocaleString('en-IN')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openNavigationForOrder(order)}
                        className="px-3 py-2 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A]/10 text-xs font-bold flex items-center gap-1"
                      >
                        <RouteIcon className="w-3.5 h-3.5" />
                        <span>Directions</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyJobId === order.id}
                        onClick={() => handleAdvance(order, nextStep)}
                        className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold"
                      >
                        {busyJobId === order.id ? 'Updating...' : nextLabel}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Open Dispatch Queue */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#222222]">
          Available Dispatch Queue ({openJobs.length})
        </h2>

        {!partnerProfile.isOnline ? (
          <div className="bg-[#F5F6F7] border border-neutral-200 rounded-xl p-6 text-xs text-neutral-600">
            Switch to <strong>Online</strong> above to accept open customer jobs.
          </div>
        ) : openJobs.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 text-xs text-neutral-500">
            No open jobs in queue right now. New customer orders appear here instantaneously.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#16A34A] uppercase">
                      {job.vertical} · {job.orderNumber}
                    </span>
                    <span className="text-sm font-extrabold text-[#222222] tabular-nums">
                      +₹{job.payoutAmount} payout
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 space-y-1">
                    <div className="truncate">
                      <strong>Pickup:</strong> {job.pickupArea}
                    </div>
                    <div className="truncate">
                      <strong>Drop:</strong> {job.dropArea}
                    </div>
                    <div className="text-[11px] text-neutral-500 tabular-nums">
                      Est Distance: {job.distanceKm ?? 3.2} km · {job.franchiseZone}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openNavigationForDispatch(job)}
                    className="px-3 py-2.5 rounded-lg border border-neutral-200 hover:border-[#16A34A] text-[#222222] text-xs font-bold flex items-center gap-1"
                  >
                    <RouteIcon className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Route</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyJobId === job.orderId}
                    onClick={() => handleAccept(job)}
                    className="flex-1 py-2.5 rounded-lg bg-[#222222] hover:bg-[#16A34A] text-white text-xs font-bold transition-colors"
                  >
                    {busyJobId === job.orderId ? 'Accepting...' : 'Accept Job'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed Ledger */}
      {pastJobs.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-[#222222]">
            Completed Fulfillments ({pastJobs.length})
          </h2>
          <div className="divide-y divide-neutral-100">
            {pastJobs.slice(0, 6).map((j) => (
              <div key={j.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span className="font-semibold text-[#222222]">{j.orderNumber}</span>
                  <span className="text-neutral-500 uppercase">{j.vertical}</span>
                </div>
                <span className="font-bold text-[#16A34A] tabular-nums">
                  +₹{Math.max(35, Math.round(j.total * 0.14 + (j.deliveryFee ?? 25)))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
