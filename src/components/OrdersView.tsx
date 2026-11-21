import React, { useState } from 'react';
import { CheckCircle2, Clock, MapPin, Package, RotateCcw, XCircle } from 'lucide-react';
import { OrderRecord } from '../types/unigo';
import { GoogleMapsView } from './GoogleMapsView';
import { cancelPlacedOrder } from '../lib/unigoDb';

interface OrdersViewProps {
  orders: OrderRecord[];
  mapsApiKey: string;
  isSignedIn: boolean;
  onRequireAuth: () => void;
  onReorder: (order: OrderRecord) => void;
}

const STEPS = ['placed', 'confirmed', 'preparing', 'en_route', 'delivered'] as const;

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  mapsApiKey,
  isSignedIn,
  onRequireAuth,
  onReorder,
}) => {
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-md mx-auto my-6">
        <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">Sign in to view Orders</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-5">
          Track active deliveries, rides, parcel couriers, and download receipts.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-md mx-auto my-6">
        <Clock className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">No Orders Yet</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Your food orders, grocery runs, rides, and home service bookings will appear here in real time.
        </p>
      </div>
    );
  }

  const handleCancel = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await cancelPlacedOrder(orderId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-extrabold text-[#222222]">
          Orders & Bookings ({orders.length})
        </h1>
        <p className="text-xs text-neutral-500">
          Real-time status synced from UniGo Partners & Operations
        </p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const isTerminal = ['delivered', 'completed', 'cancelled'].includes(order.status);
          const stepIndex =
            order.status === 'completed'
              ? 4
              : STEPS.indexOf(order.status as (typeof STEPS)[number]);
          const showMap = trackingOrderId === order.id;

          return (
            <div
              key={order.id}
              className="bg-white border border-neutral-200 rounded-xl p-4 md:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-bold text-[#222222] uppercase">
                      {order.vertical}
                    </span>
                    <span>·</span>
                    <span className="tabular-nums font-medium">{order.orderNumber}</span>
                    <span>·</span>
                    <span
                      className={`font-bold capitalize ${
                        order.status === 'cancelled'
                          ? 'text-red-600'
                          : isTerminal
                          ? 'text-[#16A34A]'
                          : 'text-amber-600'
                      }`}
                    >
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#222222] mt-1">
                    {order.items && order.items.length > 0
                      ? order.items.map((i) => `${i.quantity}x ${i.title}`).join(', ')
                      : order.notes || `${order.vertical} booking`}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate max-w-md">{order.deliveryAddress}</span>
                  </div>
                </div>

                <div className="text-right tabular-nums">
                  <div className="text-base font-extrabold text-[#222222]">
                    ₹{order.total.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {order.paymentMethod} · {order.paymentStatus}
                  </div>
                </div>
              </div>

              {/* Progress Track */}
              {order.status !== 'cancelled' && (
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {STEPS.map((st, idx) => {
                    const reached = stepIndex >= idx;
                    return (
                      <div key={st} className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            reached ? 'bg-[#16A34A]' : 'bg-neutral-200'
                          }`}
                        />
                        <div
                          className={`text-[10px] capitalize truncate ${
                            reached ? 'text-[#222222] font-semibold' : 'text-neutral-400'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {order.partnerName && (
                <div className="text-xs text-neutral-600 bg-[#F5F6F7] px-3 py-2 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                  <span>
                    Assigned Partner: <strong className="text-[#222222]">{order.partnerName}</strong>
                  </span>
                </div>
              )}

              {showMap && (
                <GoogleMapsView
                  apiKey={mapsApiKey}
                  origin={order.pickupCoords || { lat: 12.9784, lng: 77.6408 }}
                  destination={order.deliveryCoords || { lat: 12.9352, lng: 77.6245 }}
                  partnerPosition={
                    order.pickupCoords && order.deliveryCoords
                      ? {
                          lat: (order.pickupCoords.lat + order.deliveryCoords.lat) / 2,
                          lng: (order.pickupCoords.lng + order.deliveryCoords.lng) / 2,
                        }
                      : { lat: 12.962, lng: 77.634 }
                  }
                  heightClass="h-56"
                />
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                {!isTerminal && (
                  <button
                    type="button"
                    onClick={() => setTrackingOrderId(showMap ? null : order.id)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-[#222222] hover:bg-[#F5F6F7]"
                  >
                    {showMap ? 'Hide Map' : 'Track Live Map'}
                  </button>
                )}

                {order.status === 'placed' && (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => handleCancel(order.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{busyId === order.id ? 'Cancelling...' : 'Cancel Order'}</span>
                  </button>
                )}

                {order.items &&
                  order.items.length > 0 &&
                  ['food', 'grocery', 'shopping'].includes(order.vertical) && (
                    <button
                      type="button"
                      onClick={() => onReorder(order)}
                      className="px-3 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reorder</span>
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
