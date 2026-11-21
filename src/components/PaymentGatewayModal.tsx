import React, { useState } from 'react';
import { Banknote, CreditCard, ShieldCheck, Smartphone, Wallet, X } from 'lucide-react';

interface PaymentGatewayModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  title: string;
  walletBalance: number;
  onSuccess: (paymentMethod: string, paymentStatus: 'paid' | 'cod', txId?: string) => Promise<void>;
}

type PayTab = 'UPI' | 'Card' | 'Wallet' | 'Cash on Delivery';

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  open,
  onClose,
  amount,
  title,
  walletBalance,
  onSuccess,
}) => {
  const [tab, setTab] = useState<PayTab>('UPI');
  const [upiId, setUpiId] = useState('unigo.user@okhdfcbank');
  const [cardLast4, setCardLast4] = useState('4242');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handlePay = async () => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: tab,
          amount,
          upiId: tab === 'UPI' ? upiId : undefined,
          cardLast4: tab === 'Card' ? cardLast4 : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment verification failed.');
      }

      const methodLabel =
        tab === 'UPI'
          ? `UPI (${upiId})`
          : tab === 'Card'
          ? `Card •••• ${cardLast4}`
          : tab;

      await onSuccess(
        methodLabel,
        data.status === 'cod' ? 'cod' : 'paid',
        data.transactionId
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to process payment.');
    } finally {
      setProcessing(false);
    }
  };

  const methods: { key: PayTab; label: string; sub: string; icon: any }[] = [
    { key: 'UPI', label: 'UPI / GPay / PhonePe', sub: 'Instant zero-fee transfer', icon: Smartphone },
    { key: 'Card', label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay', icon: CreditCard },
    {
      key: 'Wallet',
      label: 'UniGo Pay Wallet',
      sub: `Available ₹${walletBalance.toLocaleString('en-IN')}`,
      icon: Wallet,
    },
    { key: 'Cash on Delivery', label: 'Cash / Pay on Delivery', sub: 'Pay partner at doorstep', icon: Banknote },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-neutral-200 shadow-2xl overflow-hidden">
        <div className="bg-[#222222] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-neutral-300">UniGo Secure Checkout</div>
            <div className="text-sm font-bold truncate max-w-[260px]">{title}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold tabular-nums">
              ₹{amount.toLocaleString('en-IN')}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-300 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            {methods.map((m) => {
              const Icon = m.icon;
              const active = tab === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setTab(m.key)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                    active
                      ? 'border-[#16A34A] bg-[#16A34A]/5'
                      : 'border-neutral-200 hover:bg-[#F5F6F7]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F5F6F7] flex items-center justify-center text-[#16A34A] shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#222222]">{m.label}</div>
                    <div className="text-[11px] text-neutral-500">{m.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {tab === 'UPI' && (
            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Enter UPI ID
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="name@okaxis"
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A]"
              />
            </div>
          )}

          {tab === 'Card' && (
            <div>
              <label className="block text-xs font-bold text-[#222222] mb-1">
                Saved Card Last 4 Digits
              </label>
              <input
                type="text"
                maxLength={4}
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                placeholder="4242"
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A] tabular-nums"
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={processing}
            onClick={handlePay}
            className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold flex items-center justify-center gap-2 tabular-nums transition-colors disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {processing
                ? 'Verifying Payment...'
                : tab === 'Cash on Delivery'
                ? `Confirm Order · ₹${amount.toLocaleString('en-IN')}`
                : `Pay ₹${amount.toLocaleString('en-IN')}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
