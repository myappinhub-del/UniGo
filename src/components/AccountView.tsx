import React, { useState } from 'react';
import {
  Check,
  Heart,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { CatalogItem, UserProfile } from '../types/unigo';
import { updateCustomerProfileInfo } from '../lib/unigoDb';
import { SafeImage } from './SafeImage';

interface AccountViewProps {
  user: UserProfile | null;
  catalog: CatalogItem[];
  onRequireAuth: () => void;
  onSignOut: () => void;
  onOpenLocationModal: () => void;
  onAddToCart: (item: CatalogItem, qtyDelta: number) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  catalog,
  onRequireAuth,
  onSignOut,
  onOpenLocationModal,
  onAddToCart,
  onProfileUpdated,
}) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center max-w-md mx-auto my-6">
        <UserIcon className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">Your UniGo Account</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-5">
          Sign in with your Email, Phone Number, or Google account to manage saved addresses, wishlist, and UniGo Pay wallet.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold"
        >
          Sign In to UniGo
        </button>
      </div>
    );
  }

  const wishlistItems = catalog.filter((c) => user.wishlistIds.includes(c.id));

  const startEdit = () => {
    setEditName(user.displayName);
    setEditPhone(user.phone || '');
    setProfileError(null);
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateCustomerProfileInfo(user.uid, {
        displayName: editName.trim(),
        phone: editPhone.trim(),
      });
      onProfileUpdated?.({
        ...user,
        displayName: editName.trim(),
        phone: editPhone.trim(),
      });
      setEditingProfile(false);
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : 'Unable to save profile details.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center text-lg font-extrabold">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[#222222]">
                {user.displayName}
              </h1>
              <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {user.email && <span>{user.email}</span>}
                {user.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#16A34A]" />
                    <span>{user.phone}</span>
                  </span>
                )}
                <span>
                  Account:{' '}
                  <strong className="text-[#222222] capitalize">
                    {user.role.replace('_', ' ')}
                  </strong>
                </span>
              </div>
              <div className="text-xs text-[#16A34A] font-semibold mt-0.5">
                Zone: {user.franchiseZone}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startEdit}
              className="px-3.5 py-2 rounded-lg border border-neutral-200 hover:bg-[#F5F6F7] text-xs font-semibold text-[#222222] flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="px-3.5 py-2 rounded-lg border border-neutral-200 hover:bg-[#F5F6F7] text-xs font-semibold text-[#222222] flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {editingProfile && (
          <form
            onSubmit={handleSaveProfile}
            className="pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Enter mobile number"
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingProfile ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="px-3 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
            {profileError && (
              <div className="sm:col-span-3 text-xs text-red-600">
                {profileError}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Wallet & Saved Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>UniGo Pay Wallet</span>
            </div>
            <div className="text-2xl font-extrabold text-[#222222] mt-1 tabular-nums">
              ₹{user.walletBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Usable across Food, Grocery, Rides &amp; Parcels
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Saved Addresses ({user.savedAddresses.length})</span>
            </div>
            <button
              type="button"
              onClick={onOpenLocationModal}
              className="text-xs font-semibold text-[#16A34A] hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="space-y-1.5">
            {user.savedAddresses.slice(0, 2).map((addr) => (
              <div key={addr.id} className="text-xs text-neutral-600 truncate">
                <strong className="text-[#222222]">{addr.label}:</strong>{' '}
                {addr.fullAddress}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Saved Wishlist */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          <h2 className="text-sm font-bold text-[#222222]">
            Saved Wishlist ({wishlistItems.length})
          </h2>
        </div>

        {wishlistItems.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Tap the heart icon on any Shopping product to save it here.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {wishlistItems.map((item) => (
              <div
                key={item.id}
                className="p-3 border border-neutral-200 rounded-xl flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F5F6F7] shrink-0">
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.title}
                    vertical={item.vertical}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#222222] truncate">
                    {item.title}
                  </div>
                  <div className="text-xs font-semibold text-[#16A34A] mt-0.5 tabular-nums">
                    ₹{item.price.toLocaleString('en-IN')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAddToCart(item, 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222222] text-white text-[11px] font-semibold shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
