import React, { useMemo, useState } from 'react';
import { MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { AddressEntry, CartItem, OrderVertical, UserProfile } from '../types/unigo';
import { SafeImage } from './SafeImage';
import { PaymentGatewayModal } from './PaymentGatewayModal';
import { createOrderWithDispatch } from '../lib/unigoDb';

interface CartCheckoutViewProps {
  cart: CartItem[];
  user: UserProfile | null;
  currentLocation: AddressEntry;
  onUpdateQty: (itemId: string, delta: number, customization?: string) => void;
  onClearCart: () => void;
  onOpenLocationModal: () => void;
  onRequireAuth: () => void;
  onCheckoutComplete: (orderId: string) => void;
  onBrowseHome: () => void;
}

export const CartCheckoutView: React.FC<CartCheckoutViewProps> = ({
  cart,
  user,
  currentLocation,
  onUpdateQty,
  onClearCart,
  onOpenLocationModal,
  onRequireAuth,
  onCheckoutComplete,
  onBrowseHome,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [tip, setTip] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  const subtotal = useMemo(
    () => cart.reduce((acc, c) => acc + c.price * c.quantity, 0),
    [cart]
  );

  const discount = useMemo(() => {
    if (appliedPromo === 'UNIGO50' && subtotal >= 249) return 50;
    if (appliedPromo === 'FRESH20') return Math.min(80, Math.round(subtotal * 0.2));
    return 0;
  }, [appliedPromo, subtotal]);

  const deliveryFee = subtotal >= 199 ? 0 : 29;
  const platformFee = 5;
  const tax = Math.round((subtotal - discount) * 0.05);
  const grandTotal = Math.max(0, subtotal - discount + deliveryFee + platformFee + tax + tip);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    setPromoError(null);
    if (code === 'UNIGO50') {
      if (subtotal < 249) {
        setPromoError('UNIGO50 requires a minimum subtotal of ₹249.');
        return;
      }
      setAppliedPromo('UNIGO50');
    } else if (code === 'FRESH20') {
      setAppliedPromo('FRESH20');
    } else {
      setPromoError('Invalid promo code. Try UNIGO50 or FRESH20.');
    }
  };

  const primaryVertical: OrderVertical = useMemo(() => {
    if (cart.some((c) => c.vertical === 'food')) return 'food';
    if (cart.some((c) => c.vertical === 'grocery')) return 'grocery';
    return 'shopping';
  }, [cart]);

  const handlePaymentSuccess = async (paymentMethod: string, paymentStatus: 'paid' | 'cod') => {
    if (!user) return;
    const orderId = await createOrderWithDispatch({
      user,
      vertical: primaryVertical,
      items: cart.map((c) => ({
        itemId: c.itemId,
        title: c.title,
        quantity: c.quantity,
        price: c.price,
        customization: c.customizationSummary,
      })),
      subtotal,
      deliveryFee,
      platformFee,
      tax,
      discount,
      total: grandTotal,
      paymentMethod,
      paymentStatus,
      pickupAddress: `${currentLocation.zone} Partner Store / Kitchen`,
      deliveryAddress: currentLocation.fullAddress,
      pickupCoords: {
        lat: Number((currentLocation.lat + 0.011).toFixed(6)),
        lng: Number((currentLocation.lng - 0.009).toFixed(6)),
      },
      deliveryCoords: {
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      },
      distanceKm: 2.1,
      notes: instructions.trim() || undefined,
    });
    setPayOpen(false);
    onClearCart();
    onCheckoutComplete(orderId);
  };

  if (cart.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-lg mx-auto my-6">
        <ShoppingBag className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">Your UniGo Cart is empty</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-5">
          Add hot meals, 12-minute groceries, or electronics from the catalog.
        </p>
        <button
          type="button"
          onClick={onBrowseHome}
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold"
        >
          Explore UniGo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#222222]">
          Cart & Checkout ({cart.reduce((s, c) => s + c.quantity, 0)} items)
        </h1>
        <button
          type="button"
          onClick={onClearCart}
          className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Cart</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          {/* Delivery Address */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <MapPin className="w-4 h-4 text-[#16A34A] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#222222]">
                  Deliver to {currentLocation.label}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {currentLocation.fullAddress}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenLocationModal}
              className="text-xs font-bold text-[#16A34A] hover:underline shrink-0"
            >
              Change
            </button>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {cart.map((item, idx) => (
              <div
                key={`${item.itemId}-${idx}`}
                className="p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F5F6F7] shrink-0">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.title}
                      vertical={item.vertical}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#222222] truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {item.parentName || item.unitLabel || item.vertical}
                      {item.customizationSummary ? ` · ${item.customizationSummary}` : ''}
                    </div>
                    <div className="text-xs font-bold text-[#222222] mt-1 tabular-nums">
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center bg-[#F5F6F7] border border-neutral-200 rounded-lg overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.itemId, -1, item.customizationSummary)}
                    className="px-2.5 py-1.5 hover:bg-neutral-200 text-[#222222]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2.5 text-xs font-bold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.itemId, 1, item.customizationSummary)}
                    className="px-2.5 py-1.5 hover:bg-neutral-200 text-[#16A34A]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Delivery Instructions & Tip */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Delivery Partner Instructions
              </label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Leave at security desk, do not ring doorbell..."
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A]"
              />
            </div>

            <div>
              <div className="text-xs font-bold text-[#222222] mb-2">
                Tip Your Delivery Partner
              </div>
              <div className="flex gap-2">
                {[0, 20, 30, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTip(amt)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold tabular-nums ${
                      tip === amt
                        ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                        : 'border-neutral-200 text-[#222222]'
                    }`}
                  >
                    {amt === 0 ? 'No Tip' : `₹${amt}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bill Summary */}
        <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <form onSubmit={handleApplyPromo} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Promo code (UNIGO50 or FRESH20)"
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg uppercase focus:outline-none focus:border-[#16A34A]"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-[#222222] text-white text-xs font-bold shrink-0"
            >
              Apply
            </button>
          </form>

          {promoError && <p className="text-xs text-red-600">{promoError}</p>}
          {appliedPromo && (
            <div className="text-xs font-semibold text-[#16A34A] flex items-center justify-between">
              <span>Applied {appliedPromo}</span>
              <button
                type="button"
                onClick={() => setAppliedPromo(null)}
                className="text-neutral-500 hover:underline"
              >
                Remove
              </button>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs tabular-nums">
            <div className="flex justify-between text-neutral-600">
              <span>Item Total</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[#16A34A] font-semibold">
                <span>Promo Discount</span>
                <span>-₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-600">
              <span>Delivery Fee {subtotal >= 199 ? '(Free above ₹199)' : ''}</span>
              <span>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Platform Fee</span>
              <span>₹{platformFee}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>GST & Charges (5%)</span>
              <span>₹{tax.toLocaleString('en-IN')}</span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Partner Tip</span>
                <span>₹{tip}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-[#222222] pt-3 border-t border-neutral-200">
              <span>To Pay</span>
              <span>₹{grandTotal.toLocaleString('en-IN')}</span>
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
            className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold flex items-center justify-center gap-2 tabular-nums transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Proceed to Payment · ₹{grandTotal.toLocaleString('en-IN')}</span>
          </button>
        </div>
      </div>

      <PaymentGatewayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={grandTotal}
        title="UniGo Cart Checkout"
        walletBalance={user?.walletBalance ?? 0}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
