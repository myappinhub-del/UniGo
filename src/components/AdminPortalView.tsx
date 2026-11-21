import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Copy,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  AdBanner,
  AdTargetVertical,
  CatalogItem,
  CatalogVertical,
  FranchiseZone,
  OrderRecord,
  OrderStatus,
  PartnerProfile,
  StaffAccount,
  UserProfile,
  UserRole,
} from '../types/unigo';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../lib/firebase';
import {
  adminDeleteAd,
  adminDeleteCatalogItem,
  adminDeleteFranchiseZone,
  adminDeleteOrder,
  adminDeleteStaffAccount,
  adminDeleteUser,
  adminSendStaffPasswordReset,
  adminToggleStaffActive,
  adminUpdateOrderStatus,
  adminUpdateStaffAccount,
  adminUpdateUserRole,
  adminUpsertAd,
  adminUpsertCatalogItem,
  adminUpsertFranchiseZone,
  makeSafeId,
  superAdminProvisionStaffAccount,
  updateSuperAdminPassword,
} from '../lib/unigoDb';
import {
  IMG_APARTMENT,
  IMG_BIRYANI,
  IMG_DOSA,
  IMG_HEADPHONES,
  IMG_HERO_GROCERY,
  IMG_HOME_INTERIOR,
  IMG_PIZZA,
  IMG_PRODUCE,
  IMG_SMARTWATCH,
} from '../data/seedCatalog';
import {
  FranchiseBoundaryMapEditor,
  FranchiseBoundaryValue,
} from './FranchiseBoundaryMapEditor';
import { SafeImage } from './SafeImage';

interface AdminPortalViewProps {
  user: UserProfile | null;
  catalog: CatalogItem[];
  orders: OrderRecord[];
  users: UserProfile[];
  staffList: StaffAccount[];
  zones: FranchiseZone[];
  ads: AdBanner[];
  mapsApiKey: string;
  onRequireAuth: () => void;
}

interface IssuedCredentialNotice {
  displayName: string;
  email: string;
  password: string;
  role: StaffAccount['role'];
  franchiseZone: string;
}

const AD_IMAGE_PRESETS = [
  { label: 'Fresh Grocery', url: IMG_HERO_GROCERY },
  { label: 'Biryani Feast', url: IMG_BIRYANI },
  { label: 'South Indian', url: IMG_DOSA },
  { label: 'Woodfired Pizza', url: IMG_PIZZA },
  { label: 'Fresh Produce', url: IMG_PRODUCE },
  { label: 'Headphones', url: IMG_HEADPHONES },
  { label: 'Smartwatch', url: IMG_SMARTWATCH },
  { label: 'Home Service', url: IMG_HOME_INTERIOR },
  { label: 'Rentals', url: IMG_APARTMENT },
];

const DEFAULT_BOUNDARY: FranchiseBoundaryValue = {
  centerLat: 12.9784,
  centerLng: 77.6408,
  radiusKm: 4.5,
  boundaryMode: 'radius',
  boundaryPoints: [],
};

function formatDocTimestamp(ts: unknown): string {
  if (!ts) return '—';
  let ms = 0;
  if (typeof ts === 'number') {
    ms = ts;
  } else if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    ms = (ts as { toMillis: () => number }).toMillis();
  } else if (typeof (ts as { seconds?: number }).seconds === 'number') {
    ms = (ts as { seconds: number }).seconds * 1000;
  }
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  user,
  catalog,
  orders,
  users,
  staffList,
  zones,
  ads,
  mapsApiKey,
  onRequireAuth,
}) => {
  const [tab, setTab] = useState<
    | 'overview'
    | 'orders'
    | 'catalog'
    | 'zones'
    | 'ads'
    | 'customers'
    | 'staff'
    | 'users'
  >('overview');
  const [zoneFilter, setZoneFilter] = useState<string>('All');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Customers Inspector State (Super Admin)
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerUid, setSelectedCustomerUid] = useState<string | null>(
    null
  );

  // Super Admin Account Password State
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [showAdminNewPassword, setShowAdminNewPassword] = useState(false);
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(
    null
  );

  // Catalog Create & Edit State
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [itemVertical, setItemVertical] = useState<CatalogVertical>('grocery');
  const [itemCategory, setItemCategory] = useState('Fresh Fruits & Veg');
  const [itemPrice, setItemPrice] = useState('149');
  const [itemSubtitle, setItemSubtitle] = useState('');
  const [itemUnitLabel, setItemUnitLabel] = useState('Standard Pack');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemZone, setItemZone] = useState('Indiranagar, Bengaluru');
  const [savingItem, setSavingItem] = useState(false);

  // Franchise Zone Create / Edit & GPS Boundary State
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneCity, setZoneCity] = useState('Bengaluru');
  const [zoneManager, setZoneManager] = useState('');
  const [zoneCommission, setZoneCommission] = useState('14');
  const [zoneBoundary, setZoneBoundary] =
    useState<FranchiseBoundaryValue>(DEFAULT_BOUNDARY);
  const [savingZone, setSavingZone] = useState(false);
  const [confirmDeleteZoneId, setConfirmDeleteZoneId] = useState<string | null>(null);

  // Promotional Ads Create / Edit State
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adCtaLabel, setAdCtaLabel] = useState('Explore Offer');
  const [adTargetVertical, setAdTargetVertical] =
    useState<AdTargetVertical>('grocery');
  const [adPromoCode, setAdPromoCode] = useState('');
  const [adBadgeText, setAdBadgeText] = useState('UniGo Special');
  const [adImageUrl, setAdImageUrl] = useState(IMG_HERO_GROCERY);
  const [adZone, setAdZone] = useState('All Zones');
  const [adPriority, setAdPriority] = useState('1');
  const [adActive, setAdActive] = useState(true);
  const [savingAd, setSavingAd] = useState(false);
  const [confirmDeleteAdId, setConfirmDeleteAdId] = useState<string | null>(null);

  // Staff Login Create & Edit State (Super Admin)
  const [editingStaffUid, setEditingStaffUid] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(true);
  const [staffRole, setStaffRole] = useState<StaffAccount['role']>('partner');
  const [staffZone, setStaffZone] = useState<string>(
    zones[0]?.name || 'Indiranagar Central'
  );
  const [staffVehicle, setStaffVehicle] =
    useState<PartnerProfile['vehicleType']>('bike');
  const [staffActive, setStaffActive] = useState(true);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [issuedNotice, setIssuedNotice] =
    useState<IssuedCredentialNotice | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [confirmDeleteStaffUid, setConfirmDeleteStaffUid] = useState<string | null>(
    null
  );

  // Orders & Users delete confirmations
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(
    null
  );
  const [confirmDeleteUserUid, setConfirmDeleteUserUid] = useState<string | null>(
    null
  );

  const isBootstrappedSuperAdmin =
    !!user &&
    user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
  const isSuperAdmin = !!user && user.role === 'super_admin';
  const isFranchiseAdmin = !!user && user.role === 'franchise_admin';

  const scopedOrders = useMemo(() => {
    if (isFranchiseAdmin && user?.franchiseZone) {
      const zKey = user.franchiseZone.split(',')[0].trim().toLowerCase();
      return orders.filter(
        (o) =>
          o.franchiseManagerUid === user.uid ||
          o.franchiseZone.toLowerCase().includes(zKey)
      );
    }
    if (zoneFilter === 'All') return orders;
    return orders.filter((o) => o.franchiseZone.includes(zoneFilter));
  }, [orders, zoneFilter, isFranchiseAdmin, user?.franchiseZone, user?.uid]);

  const gmv = useMemo(
    () =>
      scopedOrders
        .filter((o) => o.status !== 'cancelled')
        .reduce((s, o) => s + o.total, 0),
    [scopedOrders]
  );

  const customerUsers = useMemo(
    () => users.filter((u) => u.role === 'customer'),
    [users]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customerUsers.filter((c) => {
      if (zoneFilter !== 'All' && !c.franchiseZone.includes(zoneFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        c.franchiseZone.toLowerCase().includes(q) ||
        c.uid.toLowerCase().includes(q)
      );
    });
  }, [customerUsers, customerSearch, zoneFilter]);

  const selectedCustomer = useMemo(() => {
    if (filteredCustomers.length === 0) return null;
    if (selectedCustomerUid) {
      const match = filteredCustomers.find(
        (c) => c.uid === selectedCustomerUid
      );
      if (match) return match;
    }
    return filteredCustomers[0];
  }, [filteredCustomers, selectedCustomerUid]);

  const ordersByUserId = useMemo(() => {
    const map = new Map<string, OrderRecord[]>();
    for (const o of orders) {
      const list = map.get(o.userId);
      if (list) {
        list.push(o);
      } else {
        map.set(o.userId, [o]);
      }
    }
    return map;
  }, [orders]);

  const notifyAction = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  if (!user) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center max-w-md mx-auto my-8">
        <Shield className="w-10 h-10 text-[#16A34A] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">
          Admin &amp; Franchise Portal
        </h2>
        <p className="text-xs text-neutral-500 mt-1 mb-5">
          Sign in with your administrator email &amp; password to manage catalogs, zones, ads, staff logins, and orders.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold"
        >
          Sign In as Administrator
        </button>
      </div>
    );
  }

  if (!isSuperAdmin && !isFranchiseAdmin) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-lg mx-auto my-8 text-center">
        <Shield className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">
          Administrator Access Required
        </h2>
        <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
          Your current account ({user.email}) has role{' '}
          <strong className="capitalize">{user.role}</strong>. Sign in with Admin or Franchise credentials issued by the Super Admin.
        </p>
      </div>
    );
  }

  const activeOrderCount = scopedOrders.filter(
    (o) => !['delivered', 'completed', 'cancelled'].includes(o.status)
  ).length;

  const availableTabs: {
    key:
      | 'overview'
      | 'orders'
      | 'catalog'
      | 'zones'
      | 'ads'
      | 'customers'
      | 'staff'
      | 'users';
    label: string;
  }[] = [
    { key: 'overview', label: 'KPI Overview' },
    { key: 'orders', label: `Orders (${scopedOrders.length})` },
    { key: 'catalog', label: `Catalog (${catalog.length})` },
    { key: 'zones', label: `Franchises (${zones.length})` },
    ...(isSuperAdmin
      ? [{ key: 'ads' as const, label: `Ads (${ads.length})` }]
      : []),
    ...(isBootstrappedSuperAdmin
      ? [
          {
            key: 'customers' as const,
            label: `Customers (${customerUsers.length})`,
          },
          { key: 'staff' as const, label: `Staff Logins (${staffList.length})` },
          { key: 'users' as const, label: `Users & RBAC (${users.length})` },
        ]
      : []),
  ];

  // --- Staff Handlers ---
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = 'UG#';
    for (let i = 0; i < 7; i += 1) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setStaffPassword(pass);
    setShowStaffPassword(true);
  };

  const resetStaffForm = () => {
    setEditingStaffUid(null);
    setStaffName('');
    setStaffEmail('');
    setStaffPhone('');
    setStaffPassword('');
    setStaffRole('partner');
    setStaffZone(zones[0]?.name || 'Indiranagar Central');
    setStaffVehicle('bike');
    setStaffActive(true);
    setStaffError(null);
  };

  const handleStartEditStaff = (staff: StaffAccount) => {
    setEditingStaffUid(staff.uid);
    setStaffName(staff.displayName);
    setStaffEmail(staff.email);
    setStaffPhone(staff.phone || '');
    setStaffRole(staff.role);
    setStaffZone(staff.franchiseZone);
    setStaffVehicle(staff.vehicleType || 'bike');
    setStaffActive(staff.active);
    setStaffPassword('');
    setStaffError(null);
    setIssuedNotice(null);
  };

  const handleSubmitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaffUid) {
      const target = staffList.find((s) => s.uid === editingStaffUid);
      if (!target || !staffName.trim()) {
        setStaffError('Provide a valid display name.');
        return;
      }
      setCreatingStaff(true);
      setStaffError(null);
      try {
        await adminUpdateStaffAccount(target, {
          displayName: staffName.trim(),
          phone: staffPhone.trim(),
          role: staffRole,
          franchiseZone: staffZone || zones[0]?.name || 'Indiranagar Central',
          vehicleType: staffRole === 'partner' ? staffVehicle : undefined,
          active: staffActive,
        });
        notifyAction(`Updated staff profile for ${staffName.trim()}.`);
        resetStaffForm();
      } catch (err: unknown) {
        setStaffError(
          err instanceof Error ? err.message : 'Failed to update staff account.'
        );
      } finally {
        setCreatingStaff(false);
      }
      return;
    }

    if (!staffName.trim() || !staffEmail.trim() || staffPassword.length < 6) {
      setStaffError('Provide full name, valid email, and password (6+ characters).');
      return;
    }

    setCreatingStaff(true);
    setStaffError(null);
    setIssuedNotice(null);
    setCopiedNotice(false);

    try {
      const assignedZone =
        staffRole === 'super_admin' && staffZone === 'All Zones'
          ? 'All Zones'
          : staffZone || zones[0]?.name || 'Indiranagar Central';

      const created = await superAdminProvisionStaffAccount({
        adminUid: user.uid,
        displayName: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim(),
        password: staffPassword,
        role: staffRole,
        franchiseZone: assignedZone,
        vehicleType: staffRole === 'partner' ? staffVehicle : undefined,
      });

      setIssuedNotice({
        displayName: created.displayName,
        email: created.email,
        password: staffPassword,
        role: created.role,
        franchiseZone: created.franchiseZone,
      });
      notifyAction(`Issued login credentials for ${created.email}.`);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
    } catch (err: unknown) {
      setStaffError(
        err instanceof Error ? err.message : 'Failed to create staff credentials.'
      );
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!issuedNotice) return;
    const roleLabel =
      issuedNotice.role === 'super_admin'
        ? 'Admin'
        : issuedNotice.role === 'franchise_admin'
        ? 'Franchise Admin'
        : 'Delivery Partner';
    const text = `UniGo ${roleLabel} Login\nEmail: ${issuedNotice.email}\nPassword: ${issuedNotice.password}\nZone: ${issuedNotice.franchiseZone}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
    } catch {
      setCopiedNotice(false);
    }
  };

  const handleSendResetEmail = async (email: string) => {
    try {
      await adminSendStaffPasswordReset(email);
      notifyAction(`Password reset email sent to ${email}.`);
    } catch (err: unknown) {
      setStaffError(
        err instanceof Error ? err.message : 'Could not send reset email.'
      );
    }
  };

  const handleSaveSuperAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNewPassword.length < 6) {
      setAdminPasswordError('Password must be at least 6 characters.');
      return;
    }
    setSavingAdminPassword(true);
    setAdminPasswordError(null);
    try {
      const msg = await updateSuperAdminPassword(adminNewPassword);
      setAdminNewPassword('');
      notifyAction(msg);
    } catch (err: unknown) {
      setAdminPasswordError(
        err instanceof Error
          ? err.message
          : 'Unable to update Super Admin password.'
      );
    } finally {
      setSavingAdminPassword(false);
    }
  };

  // --- Catalog Handlers ---
  const resetCatalogForm = () => {
    setEditingCatalogId(null);
    setItemTitle('');
    setItemVertical('grocery');
    setItemCategory('Fresh Fruits & Veg');
    setItemPrice('149');
    setItemSubtitle('');
    setItemUnitLabel('Standard Pack');
    setItemImageUrl('');
    setItemZone(user.franchiseZone || 'Indiranagar, Bengaluru');
  };

  const handleStartEditCatalog = (item: CatalogItem) => {
    setEditingCatalogId(item.id);
    setItemTitle(item.title);
    setItemVertical(item.vertical);
    setItemCategory(item.category);
    setItemPrice(String(item.price));
    setItemSubtitle(item.subtitle || '');
    setItemUnitLabel(item.unitLabel || 'Standard Pack');
    setItemImageUrl(item.imageUrl || '');
    setItemZone(item.franchiseZone);
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) return;
    setSavingItem(true);
    try {
      const defaultImg =
        itemVertical === 'dish' || itemVertical === 'restaurant'
          ? IMG_BIRYANI
          : itemVertical === 'grocery'
          ? IMG_PRODUCE
          : IMG_HERO_GROCERY;

      const existing = editingCatalogId
        ? catalog.find((c) => c.id === editingCatalogId)
        : undefined;

      await adminUpsertCatalogItem(
        {
          id: editingCatalogId || makeSafeId('cat'),
          vertical: itemVertical,
          title: itemTitle.trim(),
          subtitle: itemSubtitle.trim() || 'Added via UniGo Admin Portal',
          category: itemCategory.trim() || 'General',
          price: Math.max(1, Number(itemPrice) || 99),
          rating: existing?.rating ?? 4.7,
          etaMinutes: existing?.etaMinutes ?? 20,
          isVeg: existing?.isVeg ?? true,
          inStock: existing?.inStock ?? true,
          unitLabel: itemUnitLabel.trim() || 'Standard Pack',
          imageUrl: itemImageUrl.trim() || existing?.imageUrl || defaultImg,
          franchiseZone:
            itemZone.trim() || user.franchiseZone || 'Indiranagar, Bengaluru',
        },
        !editingCatalogId
      );
      notifyAction(
        editingCatalogId
          ? `Updated catalog item "${itemTitle.trim()}".`
          : `Published "${itemTitle.trim()}" to live catalog.`
      );
      resetCatalogForm();
    } finally {
      setSavingItem(false);
    }
  };

  // --- Franchise Zone + GPS Boundary Handlers ---
  const resetZoneForm = () => {
    setEditingZoneId(null);
    setZoneName('');
    setZoneCity('Bengaluru');
    setZoneManager('');
    setZoneCommission('14');
    setZoneBoundary(DEFAULT_BOUNDARY);
  };

  const handleStartEditZone = (z: FranchiseZone) => {
    setEditingZoneId(z.id);
    setZoneName(z.name);
    setZoneCity(z.city);
    setZoneManager(z.managerEmail);
    setZoneCommission(String(z.commissionRate));
    setZoneBoundary({
      centerLat: z.centerLat ?? 12.9784,
      centerLng: z.centerLng ?? 77.6408,
      radiusKm: z.radiusKm ?? 4.5,
      boundaryMode: z.boundaryMode || 'radius',
      boundaryPoints: z.boundaryPoints || [],
    });
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim() || !zoneManager.trim()) return;
    setSavingZone(true);
    try {
      const existing = editingZoneId
        ? zones.find((z) => z.id === editingZoneId)
        : undefined;

      await adminUpsertFranchiseZone(
        {
          id: editingZoneId || makeSafeId('zone'),
          name: zoneName.trim(),
          city: zoneCity.trim() || 'Bengaluru',
          managerEmail: zoneManager.trim(),
          managerUid: existing?.managerUid,
          opsAdminUid: existing?.opsAdminUid,
          commissionRate: Number(zoneCommission) || 14,
          centerLat: zoneBoundary.centerLat,
          centerLng: zoneBoundary.centerLng,
          radiusKm: zoneBoundary.radiusKm,
          boundaryMode: zoneBoundary.boundaryMode,
          boundaryPoints: zoneBoundary.boundaryPoints,
          isActive: existing?.isActive ?? true,
        },
        !editingZoneId
      );
      notifyAction(
        editingZoneId
          ? `Updated franchise zone & GPS boundary for ${zoneName.trim()}.`
          : `Created franchise zone ${zoneName.trim()} with GPS boundary.`
      );
      resetZoneForm();
    } finally {
      setSavingZone(false);
    }
  };

  // --- Promotional Ads Handlers ---
  const resetAdForm = () => {
    setEditingAdId(null);
    setAdTitle('');
    setAdSubtitle('');
    setAdCtaLabel('Explore Offer');
    setAdTargetVertical('grocery');
    setAdPromoCode('');
    setAdBadgeText('UniGo Special');
    setAdImageUrl(IMG_HERO_GROCERY);
    setAdZone('All Zones');
    setAdPriority('1');
    setAdActive(true);
  };

  const handleStartEditAd = (ad: AdBanner) => {
    setEditingAdId(ad.id);
    setAdTitle(ad.title);
    setAdSubtitle(ad.subtitle);
    setAdCtaLabel(ad.ctaLabel);
    setAdTargetVertical(ad.targetVertical);
    setAdPromoCode(ad.promoCode || '');
    setAdBadgeText(ad.badgeText || '');
    setAdImageUrl(ad.imageUrl || IMG_HERO_GROCERY);
    setAdZone(ad.franchiseZone || 'All Zones');
    setAdPriority(String(ad.priority ?? 1));
    setAdActive(ad.isActive);
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle.trim() || !adSubtitle.trim()) return;
    setSavingAd(true);
    try {
      await adminUpsertAd(
        {
          id: editingAdId || makeSafeId('ad'),
          title: adTitle.trim(),
          subtitle: adSubtitle.trim(),
          ctaLabel: adCtaLabel.trim() || 'Shop Now',
          targetVertical: adTargetVertical,
          promoCode: adPromoCode.trim().toUpperCase(),
          badgeText: adBadgeText.trim() || 'UniGo Offer',
          imageUrl: adImageUrl.trim() || IMG_HERO_GROCERY,
          franchiseZone: adZone || 'All Zones',
          priority: Math.min(100, Math.max(1, Number(adPriority) || 1)),
          isActive: adActive,
        },
        !editingAdId
      );
      notifyAction(
        editingAdId
          ? `Updated promotional ad "${adTitle.trim()}".`
          : `Published promotional ad "${adTitle.trim()}" live to customers.`
      );
      resetAdForm();
    } finally {
      setSavingAd(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-neutral-200 rounded-xl p-5">
        <div>
          <div className="text-xs font-semibold text-[#16A34A]">
            {isBootstrappedSuperAdmin
              ? 'Super Admin Console'
              : isSuperAdmin
              ? `Operations Admin · ${user.franchiseZone}`
              : `Franchise Admin · ${user.franchiseZone}`}
          </div>
          <h1 className="text-xl font-extrabold text-[#222222] mt-0.5">
            UniGo Operations &amp; Franchise Control
          </h1>
        </div>

        {!isFranchiseAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-[#F5F6F7] border border-neutral-200 rounded-lg"
            >
              <option value="All">All Franchise Zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.name.split(' ')[0]}>
                  {z.name} ({z.city})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {statusFeedback && (
        <div className="p-3 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 text-xs font-semibold text-[#14532D] flex items-center justify-between">
          <span>{statusFeedback}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-neutral-600 hover:text-[#222222]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {availableTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold border whitespace-nowrap ${
              tab === key
                ? 'bg-[#222222] text-white border-[#222222]'
                : 'bg-white text-[#222222] border-neutral-200 hover:bg-[#F5F6F7]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Gross Merchandise Value',
                val: `₹${gmv.toLocaleString('en-IN')}`,
              },
              { label: 'Active Orders', val: String(activeOrderCount) },
              { label: 'Catalog SKUs', val: String(catalog.length) },
              {
                label: 'Active Zones',
                val: String(zones.filter((z) => z.isActive).length),
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white border border-neutral-200 rounded-xl p-4"
              >
                <div className="text-xs text-neutral-500">{kpi.label}</div>
                <div className="text-2xl font-extrabold text-[#222222] mt-1 tabular-nums">
                  {kpi.val}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#16A34A]" />
              <h2 className="text-sm font-bold text-[#222222]">
                Recent Orders Across Verticals
              </h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {scopedOrders.slice(0, 6).map((o) => (
                <div
                  key={o.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#222222]">
                      {o.orderNumber}
                    </span>
                    <span className="text-neutral-500 ml-2 uppercase">
                      {o.vertical}
                    </span>
                    <span className="text-neutral-400 ml-2">{o.userName}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="capitalize text-neutral-600">
                      {o.status.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-[#222222]">
                      ₹{o.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
              {scopedOrders.length === 0 && (
                <p className="text-xs text-neutral-500 py-3">
                  No orders placed yet in this zone.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ORDERS */}
      {tab === 'orders' && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F6F7] border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Vertical</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status Override</th>
                  {isSuperAdmin && <th className="py-3 px-4 text-right">Remove</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {scopedOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 px-4 font-bold text-[#222222] tabular-nums">
                      {o.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {o.userName || o.userEmail}
                    </td>
                    <td className="py-3 px-4 uppercase font-semibold text-neutral-600">
                      {o.vertical}
                    </td>
                    <td className="py-3 px-4 text-neutral-500">
                      {o.franchiseZone}
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      ₹{o.total.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          adminUpdateOrderStatus(o, e.target.value as OrderStatus)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-[#F5F6F7] text-xs font-semibold"
                      >
                        {(
                          [
                            'placed',
                            'confirmed',
                            'preparing',
                            'en_route',
                            'delivered',
                            'completed',
                            'cancelled',
                          ] as const
                        ).map((st) => (
                          <option key={st} value={st}>
                            {st.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-right">
                        {confirmDeleteOrderId === o.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await adminDeleteOrder(o.id);
                                setConfirmDeleteOrderId(null);
                                notifyAction(`Removed order ${o.orderNumber}.`);
                              }}
                              className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteOrderId(null)}
                              className="px-2 py-1 rounded border border-neutral-200 text-[11px] font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteOrderId(o.id)}
                            aria-label="Remove order"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATALOG */}
      {tab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleSaveCatalogItem}
            className="lg:col-span-4 bg-white border border-neutral-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#222222] flex items-center gap-1.5">
                {editingCatalogId ? (
                  <Pencil className="w-4 h-4 text-[#16A34A]" />
                ) : (
                  <Plus className="w-4 h-4 text-[#16A34A]" />
                )}
                <span>
                  {editingCatalogId ? 'Edit Catalog Item' : 'Add Catalog Item'}
                </span>
              </h2>
              {editingCatalogId && (
                <button
                  type="button"
                  onClick={resetCatalogForm}
                  className="text-xs font-semibold text-neutral-500 hover:text-[#222222]"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Vertical
              </label>
              <select
                value={itemVertical}
                onChange={(e) =>
                  setItemVertical(e.target.value as CatalogVertical)
                }
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              >
                <option value="restaurant">Restaurant</option>
                <option value="dish">Food Dish</option>
                <option value="grocery">Grocery Item</option>
                <option value="shopping">Shopping Product</option>
                <option value="service">Home Service</option>
                <option value="rental">Rental Listing</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="e.g., Organic Tender Coconut Water"
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Unit / Pack Label
                </label>
                <input
                  type="text"
                  value={itemUnitLabel}
                  onChange={(e) => setItemUnitLabel(e.target.value)}
                  placeholder="e.g., 500 g pack"
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Franchise Zone
                </label>
                <input
                  type="text"
                  value={itemZone}
                  onChange={(e) => setItemZone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Subtitle / Description
              </label>
              <input
                type="text"
                value={itemSubtitle}
                onChange={(e) => setItemSubtitle(e.target.value)}
                placeholder="Short description..."
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Image URL (optional)
              </label>
              <input
                type="text"
                value={itemImageUrl}
                onChange={(e) => setItemImageUrl(e.target.value)}
                placeholder="/src/assets/images/..."
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={savingItem}
              className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold"
            >
              {savingItem
                ? 'Saving...'
                : editingCatalogId
                ? 'Save Catalog Changes'
                : 'Publish to Live Catalog'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {catalog.map((item) => (
              <div
                key={item.id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[#222222] truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {item.vertical.toUpperCase()} · {item.category} · ₹
                    {item.price.toLocaleString('en-IN')} · {item.franchiseZone}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      adminUpsertCatalogItem(
                        { ...item, inStock: !item.inStock },
                        false
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg border font-semibold ${
                      item.inStock
                        ? 'border-[#16A34A] text-[#16A34A]'
                        : 'border-neutral-300 text-neutral-500'
                    }`}
                  >
                    {item.inStock ? 'In Stock' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditCatalog(item)}
                    aria-label="Edit catalog item"
                    className="p-1.5 rounded-lg text-[#222222] hover:bg-[#F5F6F7]"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminDeleteCatalogItem(item.id);
                      if (editingCatalogId === item.id) resetCatalogForm();
                      notifyAction(`Removed "${item.title}" from catalog.`);
                    }}
                    aria-label="Delete item"
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FRANCHISE ZONES WITH GPS BOUNDARY EDITOR */}
      {tab === 'zones' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {isSuperAdmin && (
            <form
              onSubmit={handleSaveZone}
              className="lg:col-span-6 bg-white border border-neutral-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#222222] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#16A34A]" />
                    <span>
                      {editingZoneId
                        ? 'Edit Franchise & GPS Boundary'
                        : 'Add Franchise Zone & GPS Boundary'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Use GPS or click the map to define the exact franchise service area.
                  </p>
                </div>
                {editingZoneId && (
                  <button
                    type="button"
                    onClick={resetZoneForm}
                    className="text-xs font-semibold text-neutral-500 hover:text-[#222222]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Franchise Zone Name
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="e.g., Whitefield Tech Hub"
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneCity}
                    onChange={(e) => setZoneCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Franchise Manager Email
                  </label>
                  <input
                    type="email"
                    required
                    value={zoneManager}
                    onChange={(e) => setZoneManager(e.target.value)}
                    placeholder="Enter manager email"
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Commission (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={zoneCommission}
                    onChange={(e) => setZoneCommission(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <FranchiseBoundaryMapEditor
                apiKey={mapsApiKey}
                value={zoneBoundary}
                onChange={setZoneBoundary}
                existingZones={zones}
                editingZoneId={editingZoneId}
              />

              <button
                type="submit"
                disabled={savingZone}
                className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {savingZone
                  ? 'Saving Franchise Zone...'
                  : editingZoneId
                  ? 'Save Franchise & Boundary'
                  : 'Create Franchise Zone'}
              </button>
            </form>
          )}

          <div
            className={`${
              isSuperAdmin ? 'lg:col-span-6' : 'lg:col-span-12'
            } grid grid-cols-1 gap-4`}
          >
            {zones.map((z) => (
              <div
                key={z.id}
                className={`bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${
                  editingZoneId === z.id
                    ? 'border-[#16A34A] ring-1 ring-[#16A34A]'
                    : 'border-neutral-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#222222] flex items-center gap-2">
                    <span>{z.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#F5F6F7] border border-neutral-200 text-neutral-600">
                      {z.city}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Manager: {z.managerEmail} · Commission: {z.commissionRate}%
                  </div>
                  <div className="text-[11px] font-semibold text-[#16A34A] mt-1 tabular-nums">
                    {z.boundaryMode === 'polygon' && z.boundaryPoints?.length
                      ? `Polygon Boundary (${z.boundaryPoints.length} GPS points)`
                      : `GPS Radius: ${z.radiusKm ?? 4.5} km`}
                    {typeof z.centerLat === 'number' && typeof z.centerLng === 'number'
                      ? ` · (${z.centerLat.toFixed(4)}, ${z.centerLng.toFixed(4)})`
                      : ''}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditZone(z)}
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-[#222222] hover:border-[#16A34A] flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Map</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adminUpsertFranchiseZone(
                          { ...z, isActive: !z.isActive },
                          false
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        z.isActive
                          ? 'border-[#16A34A] text-[#16A34A]'
                          : 'border-neutral-300 text-neutral-500'
                      }`}
                    >
                      {z.isActive ? 'Active' : 'Paused'}
                    </button>
                    {confirmDeleteZoneId === z.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await adminDeleteFranchiseZone(z.id);
                            setConfirmDeleteZoneId(null);
                            if (editingZoneId === z.id) resetZoneForm();
                            notifyAction(`Removed franchise zone "${z.name}".`);
                          }}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteZoneId(null)}
                          className="px-2 py-1 rounded border border-neutral-200 text-[11px]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteZoneId(z.id)}
                        aria-label="Delete franchise zone"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROMOTIONAL ADS & BANNERS */}
      {tab === 'ads' && isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleSaveAd}
            className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#16A34A]" />
                <h2 className="text-sm font-bold text-[#222222]">
                  {editingAdId ? 'Edit Promotional Ad' : 'Create Promotional Ad'}
                </h2>
              </div>
              {editingAdId && (
                <button
                  type="button"
                  onClick={resetAdForm}
                  className="text-xs font-semibold text-neutral-500 hover:text-[#222222]"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Headline
              </label>
              <input
                type="text"
                required
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                placeholder="e.g., Flat 30% Off Fresh Monsoon Mangoes"
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Offer Details / Subtitle
              </label>
              <textarea
                rows={2}
                required
                value={adSubtitle}
                onChange={(e) => setAdSubtitle(e.target.value)}
                placeholder="Describe the promotion, discount cap, or delivery perk..."
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Button CTA Label
                </label>
                <input
                  type="text"
                  required
                  value={adCtaLabel}
                  onChange={(e) => setAdCtaLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Target Service
                </label>
                <select
                  value={adTargetVertical}
                  onChange={(e) =>
                    setAdTargetVertical(e.target.value as AdTargetVertical)
                  }
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg font-semibold"
                >
                  <option value="grocery">Grocery</option>
                  <option value="food">Food Delivery</option>
                  <option value="shopping">Shopping</option>
                  <option value="rides">Rides</option>
                  <option value="services">Home Services</option>
                  <option value="rentals">Rentals</option>
                  <option value="parcel">Parcel Delivery</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Promo Code
                </label>
                <input
                  type="text"
                  value={adPromoCode}
                  onChange={(e) => setAdPromoCode(e.target.value)}
                  placeholder="UNIGO50"
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg uppercase"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Badge Tag
                </label>
                <input
                  type="text"
                  value={adBadgeText}
                  onChange={(e) => setAdBadgeText(e.target.value)}
                  placeholder="Flash Deal"
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Priority (1-100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={adPriority}
                  onChange={(e) => setAdPriority(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Target Franchise Zone
                </label>
                <select
                  value={adZone}
                  onChange={(e) => setAdZone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                >
                  <option value="All Zones">All Zones</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs font-bold text-[#222222] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adActive}
                    onChange={(e) => setAdActive(e.target.checked)}
                    className="w-4 h-4 accent-[#16A34A]"
                  />
                  <span>Active on Customer Home</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                Banner Image URL
              </label>
              <input
                type="text"
                value={adImageUrl}
                onChange={(e) => setAdImageUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {AD_IMAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setAdImageUrl(preset.url)}
                    className={`px-2 py-1 rounded border text-[10px] font-semibold ${
                      adImageUrl === preset.url
                        ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                        : 'border-neutral-200 bg-white text-neutral-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAd}
              className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors disabled:opacity-60"
            >
              {savingAd
                ? 'Saving Ad...'
                : editingAdId
                ? 'Save Ad Changes'
                : 'Publish Promotional Ad'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {ads.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-6 text-xs text-neutral-500">
                No promotional ads created yet. Publish an ad on the left to feature it on the UniGo Customer Home banner.
              </div>
            ) : (
              ads.map((ad) => (
                <div
                  key={ad.id}
                  className={`bg-white border rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between ${
                    editingAdId === ad.id
                      ? 'border-[#16A34A] ring-1 ring-[#16A34A]'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className="w-24 h-20 rounded-lg overflow-hidden bg-[#F5F6F7] shrink-0">
                      <SafeImage
                        src={ad.imageUrl || IMG_HERO_GROCERY}
                        alt={ad.title}
                        vertical="grocery"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-[#16A34A]">
                        <span>{ad.badgeText || 'Promo'}</span>
                        <span>·</span>
                        <span>Priority #{ad.priority}</span>
                        <span>·</span>
                        <span>{ad.franchiseZone}</span>
                        {ad.promoCode && (
                          <span className="px-1.5 py-0.5 rounded bg-[#16A34A]/10 text-[#16A34A]">
                            {ad.promoCode}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#222222] mt-0.5 line-clamp-1">
                        {ad.title}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {ad.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEditAd(ad)}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-[#222222] hover:border-[#16A34A] flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          adminUpsertAd({ ...ad, isActive: !ad.isActive }, false)
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                          ad.isActive
                            ? 'border-[#16A34A] text-[#16A34A]'
                            : 'border-neutral-300 text-neutral-500'
                        }`}
                      >
                        {ad.isActive ? 'Live' : 'Paused'}
                      </button>
                      {confirmDeleteAdId === ad.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await adminDeleteAd(ad.id);
                              setConfirmDeleteAdId(null);
                              if (editingAdId === ad.id) resetAdForm();
                              notifyAction(`Removed ad "${ad.title}".`);
                            }}
                            className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAdId(null)}
                            className="px-2 py-1 rounded border border-neutral-200 text-[11px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAdId(ad.id)}
                          aria-label="Delete promotional ad"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400 capitalize">
                      Target: {ad.targetVertical}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CUSTOMERS DIRECTORY & FULL DETAILS (SUPER ADMIN) */}
      {tab === 'customers' && isBootstrappedSuperAdmin && (
        <div className="space-y-5">
          {/* Customer KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Registered Customers</div>
              <div className="text-2xl font-extrabold text-[#222222] mt-1 tabular-nums">
                {customerUsers.length}
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Active Ordering Customers</div>
              <div className="text-2xl font-extrabold text-[#222222] mt-1 tabular-nums">
                {
                  customerUsers.filter(
                    (c) => (ordersByUserId.get(c.uid)?.length ?? 0) > 0
                  ).length
                }
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Total Customer Spend</div>
              <div className="text-2xl font-extrabold text-[#16A34A] mt-1 tabular-nums">
                ₹
                {customerUsers
                  .reduce((sum, c) => {
                    const cOrders = ordersByUserId.get(c.uid) || [];
                    return (
                      sum +
                      cOrders
                        .filter((o) => o.status !== 'cancelled')
                        .reduce((s, o) => s + o.total, 0)
                    );
                  }, 0)
                  .toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Total Wallet Credits</div>
              <div className="text-2xl font-extrabold text-[#222222] mt-1 tabular-nums">
                ₹
                {customerUsers
                  .reduce((sum, c) => sum + (c.walletBalance || 0), 0)
                  .toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Customer List + Search */}
            <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="p-3.5 border-b border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#16A34A]" />
                    <span>All Customers ({filteredCustomers.length})</span>
                  </h2>
                  <span className="text-[11px] text-neutral-500">
                    Click to inspect
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search name, phone, email, zone, UID..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-xs text-neutral-500">
                  No customers match your current filter.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 max-h-[640px] overflow-y-auto">
                  {filteredCustomers.map((c) => {
                    const cOrders = ordersByUserId.get(c.uid) || [];
                    const cSpend = cOrders
                      .filter((o) => o.status !== 'cancelled')
                      .reduce((s, o) => s + o.total, 0);
                    const isSelected = selectedCustomer?.uid === c.uid;
                    return (
                      <button
                        key={c.uid}
                        type="button"
                        onClick={() => setSelectedCustomerUid(c.uid)}
                        className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#16A34A]/10 border-l-4 border-[#16A34A]'
                            : 'hover:bg-[#F5F6F7]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#222222] truncate">
                            {c.displayName}
                          </div>
                          <div className="text-[11px] text-neutral-600 truncate mt-0.5">
                            {c.email || c.phone || c.uid}
                          </div>
                          {c.email && c.phone && (
                            <div className="text-[11px] text-neutral-500 truncate">
                              {c.phone}
                            </div>
                          )}
                          <div className="text-[11px] text-[#16A34A] font-medium mt-0.5 truncate">
                            {c.franchiseZone}
                          </div>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <div className="text-xs font-extrabold text-[#222222]">
                            ₹{cSpend.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {cOrders.length}{' '}
                            {cOrders.length === 1 ? 'order' : 'orders'}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            Wallet ₹{(c.walletBalance || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Full Customer Details Panel */}
            <div className="lg:col-span-7 space-y-4">
              {!selectedCustomer ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-xs text-neutral-500">
                  Select a customer on the left to view complete profile, saved addresses, wishlist, wallet, and order history.
                </div>
              ) : (() => {
                const cOrders = ordersByUserId.get(selectedCustomer.uid) || [];
                const totalSpend = cOrders
                  .filter((o) => o.status !== 'cancelled')
                  .reduce((s, o) => s + o.total, 0);
                const wishlistProducts = catalog.filter((item) =>
                  (selectedCustomer.wishlistIds || []).includes(item.id)
                );

                return (
                  <div className="space-y-4">
                    {/* Customer Identity & Summary */}
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center text-base font-extrabold shrink-0">
                            {selectedCustomer.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-extrabold text-[#222222]">
                                {selectedCustomer.displayName}
                              </h3>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#F5F6F7] border border-neutral-200 text-neutral-700">
                                {selectedCustomer.role}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500 mt-0.5 break-all">
                              UID: {selectedCustomer.uid}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {confirmDeleteUserUid === selectedCustomer.uid ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await adminDeleteUser(selectedCustomer.uid);
                                  setConfirmDeleteUserUid(null);
                                  setSelectedCustomerUid(null);
                                  notifyAction(
                                    `Removed customer ${selectedCustomer.displayName}.`
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                              >
                                Confirm Remove
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserUid(null)}
                                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteUserUid(selectedCustomer.uid)
                              }
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs">
                        <div className="p-3 rounded-lg bg-[#F5F6F7]">
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#16A34A]" />
                            <span>Email</span>
                          </div>
                          <div className="font-semibold text-[#222222] mt-0.5 break-all">
                            {selectedCustomer.email || 'Phone-only login'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#F5F6F7]">
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#16A34A]" />
                            <span>Phone</span>
                          </div>
                          <div className="font-semibold text-[#222222] mt-0.5">
                            {selectedCustomer.phone || 'Not provided'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#F5F6F7]">
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-[#16A34A]" />
                            <span>Wallet Balance</span>
                          </div>
                          <div className="font-extrabold text-[#16A34A] mt-0.5 tabular-nums">
                            ₹
                            {(selectedCustomer.walletBalance || 0).toLocaleString(
                              'en-IN'
                            )}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#F5F6F7]">
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 text-[#16A34A]" />
                            <span>Lifetime Orders</span>
                          </div>
                          <div className="font-extrabold text-[#222222] mt-0.5 tabular-nums">
                            {cOrders.length} · ₹
                            {totalSpend.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-neutral-500 pt-1">
                        <div>
                          <strong className="text-[#222222]">Zone:</strong>{' '}
                          {selectedCustomer.franchiseZone}
                        </div>
                        <div>
                          <strong className="text-[#222222]">Joined:</strong>{' '}
                          {formatDocTimestamp(selectedCustomer.createdAt)}
                        </div>
                        <div>
                          <strong className="text-[#222222]">Updated:</strong>{' '}
                          {formatDocTimestamp(selectedCustomer.updatedAt)}
                        </div>
                      </div>
                    </div>

                    {/* Saved Addresses */}
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#16A34A]" />
                        <span>
                          Saved Delivery Addresses (
                          {selectedCustomer.savedAddresses?.length || 0})
                        </span>
                      </h4>
                      {!selectedCustomer.savedAddresses ||
                      selectedCustomer.savedAddresses.length === 0 ? (
                        <p className="text-xs text-neutral-500">
                          No saved addresses recorded for this customer.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {selectedCustomer.savedAddresses.map((addr) => (
                            <div
                              key={addr.id}
                              className="p-3 rounded-lg bg-[#F5F6F7] border border-neutral-200 text-xs space-y-1"
                            >
                              <div className="font-bold text-[#222222]">
                                {addr.label}
                              </div>
                              <div className="text-neutral-600">
                                {addr.fullAddress}
                              </div>
                              <div className="text-[11px] text-neutral-500 tabular-nums">
                                {addr.zone} · ({addr.lat.toFixed(4)},{' '}
                                {addr.lng.toFixed(4)})
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Order & Booking History */}
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-[#16A34A]" />
                        <span>
                          Complete Order &amp; Booking History ({cOrders.length})
                        </span>
                      </h4>
                      {cOrders.length === 0 ? (
                        <p className="text-xs text-neutral-500">
                          This customer has not placed any orders or bookings yet.
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                          {cOrders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-3.5 rounded-lg border border-neutral-200 bg-[#F5F6F7]/60 text-xs space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-[#222222] tabular-nums">
                                    {ord.orderNumber}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white border border-neutral-200 text-[#16A34A]">
                                    {ord.vertical}
                                  </span>
                                  <span className="capitalize font-semibold text-neutral-700">
                                    {ord.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="text-right tabular-nums">
                                  <span className="font-extrabold text-[#222222]">
                                    ₹{ord.total.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[11px] text-neutral-500 ml-2">
                                    {ord.paymentMethod} ({ord.paymentStatus})
                                  </span>
                                </div>
                              </div>

                              <div className="text-[11px] text-neutral-600 space-y-0.5">
                                {ord.pickupAddress && (
                                  <div>
                                    <strong>Pickup:</strong> {ord.pickupAddress}
                                  </div>
                                )}
                                {ord.deliveryAddress && (
                                  <div>
                                    <strong>Drop / Address:</strong>{' '}
                                    {ord.deliveryAddress}
                                  </div>
                                )}
                                <div>
                                  <strong>Placed:</strong>{' '}
                                  {formatDocTimestamp(ord.createdAt)} ·{' '}
                                  <strong>Zone:</strong> {ord.franchiseZone}
                                  {ord.partnerName
                                    ? ` · Partner: ${ord.partnerName}`
                                    : ''}
                                </div>
                              </div>

                              {ord.items && ord.items.length > 0 && (
                                <div className="pt-1.5 border-t border-neutral-200/80 space-y-0.5 text-[11px] text-neutral-700">
                                  {ord.items.map((line, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between"
                                    >
                                      <span>
                                        {line.quantity} × {line.title}
                                        {line.customization
                                          ? ` (${line.customization})`
                                          : ''}
                                      </span>
                                      <span className="tabular-nums font-semibold">
                                        ₹
                                        {(
                                          line.price * line.quantity
                                        ).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Wishlist */}
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span>
                          Wishlist Items (
                          {selectedCustomer.wishlistIds?.length || 0})
                        </span>
                      </h4>
                      {wishlistProducts.length === 0 ? (
                        <p className="text-xs text-neutral-500">
                          No wishlist items saved.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {wishlistProducts.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-lg border border-neutral-200 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-[#222222] truncate">
                                  {item.title}
                                </div>
                                <div className="text-[11px] text-neutral-500">
                                  {item.category}
                                </div>
                              </div>
                              <div className="font-bold text-[#16A34A] shrink-0 tabular-nums">
                                ₹{item.price.toLocaleString('en-IN')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* STAFF LOGINS (CREATE / EDIT / RESET PASSWORD / REMOVE) */}
      {tab === 'staff' && isBootstrappedSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSubmitStaff}
              className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editingStaffUid ? (
                    <Pencil className="w-4 h-4 text-[#16A34A]" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-[#16A34A]" />
                  )}
                  <h2 className="text-sm font-bold text-[#222222]">
                    {editingStaffUid
                      ? 'Edit Staff / Delivery Account'
                      : 'Create Staff Login (Email & Password)'}
                  </h2>
                </div>
                {editingStaffUid && (
                  <button
                    type="button"
                    onClick={resetStaffForm}
                    className="text-xs font-semibold text-neutral-500 hover:text-[#222222]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                {editingStaffUid
                  ? 'Update name, phone, portal role, assigned franchise zone, or active status. Use Reset Pass on the card to email a password link.'
                  : 'Issue direct Email & Password logins for Franchise Managers, Delivery Partners, and Operations Admins.'}
              </p>

              {staffError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
                  {staffError}
                </div>
              )}

              {issuedNotice && (
                <div className="p-3.5 rounded-xl bg-[#16A34A]/5 border border-[#16A34A]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#16A34A] flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Credentials Ready</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-[11px] font-bold text-[#222222] flex items-center gap-1"
                    >
                      {copiedNotice ? (
                        <>
                          <Check className="w-3 h-3 text-[#16A34A]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#222222] space-y-0.5 font-mono">
                    <div>Email: {issuedNotice.email}</div>
                    <div>Password: {issuedNotice.password}</div>
                    <div>
                      Portal:{' '}
                      {issuedNotice.role === 'super_admin'
                        ? 'Admin Portal'
                        : issuedNotice.role === 'franchise_admin'
                        ? 'Franchise Portal'
                        : 'Delivery Partner App'}{' '}
                      ({issuedNotice.franchiseZone})
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Login Email
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingStaffUid}
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="Enter login email"
                  className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg disabled:opacity-60"
                />
              </div>

              {!editingStaffUid && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-neutral-600">
                      Assigned Password
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-semibold text-[#16A34A] hover:underline"
                    >
                      Generate Password
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Enter password (min 6 characters)"
                      className="w-full pl-3 pr-9 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword((p) => !p)}
                      aria-label="Toggle password visibility"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#222222]"
                    >
                      {showStaffPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Assigned Portal Role
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) =>
                      setStaffRole(e.target.value as StaffAccount['role'])
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg font-semibold"
                  >
                    <option value="partner">Delivery Man / Partner</option>
                    <option value="franchise_admin">Franchise Manager</option>
                    <option value="super_admin">Operations Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Assigned Zone
                  </label>
                  <select
                    value={staffZone}
                    onChange={(e) => setStaffZone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  >
                    {staffRole === 'super_admin' && (
                      <option value="All Zones">All Zones</option>
                    )}
                    {zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name} ({z.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {staffRole === 'partner' && (
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                    Partner Vehicle / Category
                  </label>
                  <select
                    value={staffVehicle}
                    onChange={(e) =>
                      setStaffVehicle(
                        e.target.value as PartnerProfile['vehicleType']
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                  >
                    <option value="bike">Bike Delivery / Bike Taxi</option>
                    <option value="auto">Auto Rickshaw Captain</option>
                    <option value="car">Prime Sedan / Cab Captain</option>
                    <option value="van">Parcel Van Courier</option>
                    <option value="technician">Home Service Technician</option>
                  </select>
                </div>
              )}

              {editingStaffUid && (
                <label className="flex items-center gap-2 text-xs font-bold text-[#222222] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffActive}
                    onChange={(e) => setStaffActive(e.target.checked)}
                    className="w-4 h-4 accent-[#16A34A]"
                  />
                  <span>Account Active (can access portal)</span>
                </label>
              )}

              <button
                type="submit"
                disabled={creatingStaff}
                className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {creatingStaff
                  ? editingStaffUid
                    ? 'Saving Changes...'
                    : 'Creating Account...'
                  : editingStaffUid
                  ? 'Save Staff Details'
                  : 'Create Login Credentials'}
              </button>
            </form>

            {/* Super Admin Direct Email & Password Login Setup */}
            <form
              onSubmit={handleSaveSuperAdminPassword}
              className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#16A34A]" />
                <h3 className="text-sm font-bold text-[#222222]">
                  Super Admin Email Password
                </h3>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Set or update the login password for{' '}
                <strong className="text-[#222222]">{user.email}</strong> so you can sign in directly with Email &amp; Password.
              </p>

              {adminPasswordError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {adminPasswordError}
                </div>
              )}

              <div className="relative">
                <input
                  type={showAdminNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Enter new Super Admin password"
                  className="w-full pl-3 pr-9 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminNewPassword((p) => !p)}
                  aria-label="Toggle admin password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#222222]"
                >
                  {showAdminNewPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={savingAdminPassword}
                className="w-full py-2 rounded-xl bg-[#222222] hover:bg-[#111111] text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {savingAdminPassword
                  ? 'Updating Password...'
                  : 'Set / Update Super Admin Password'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#222222]">
                Issued Staff Logins ({staffList.length})
              </h3>
              <span className="text-[11px] text-neutral-500">
                Edit, Reset Password, Suspend, or Remove
              </span>
            </div>

            {staffList.length === 0 ? (
              <div className="p-6 text-xs text-neutral-500">
                No staff logins issued yet. Create a Franchise Manager or Delivery Partner login on the left.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {staffList.map((staff) => (
                  <div
                    key={staff.uid}
                    className={`p-4 flex flex-wrap items-center justify-between gap-3 text-xs ${
                      editingStaffUid === staff.uid ? 'bg-[#16A34A]/5' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#222222] flex items-center gap-2">
                        <span>{staff.displayName}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#F5F6F7] border border-neutral-200 text-[#222222]">
                          {staff.role === 'super_admin'
                            ? 'Admin'
                            : staff.role === 'franchise_admin'
                            ? 'Franchise'
                            : 'Delivery Partner'}
                        </span>
                      </div>
                      <div className="text-neutral-600 mt-0.5">
                        {staff.email}
                        {staff.phone ? ` · ${staff.phone}` : ''} ·{' '}
                        {staff.franchiseZone}
                        {staff.vehicleType
                          ? ` · ${staff.vehicleType.toUpperCase()}`
                          : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditStaff(staff)}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-[#222222] hover:border-[#16A34A] flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendResetEmail(staff.email)}
                        title="Send Password Reset Email"
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-[#222222] hover:border-[#16A34A] flex items-center gap-1"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>Reset Pass</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void adminToggleStaffActive(staff, !staff.active)
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                          staff.active
                            ? 'border-[#16A34A] text-[#16A34A]'
                            : 'border-neutral-300 text-neutral-500'
                        }`}
                      >
                        {staff.active ? 'Active' : 'Suspended'}
                      </button>

                      {confirmDeleteStaffUid === staff.uid ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await adminDeleteStaffAccount(staff);
                              setConfirmDeleteStaffUid(null);
                              if (editingStaffUid === staff.uid) resetStaffForm();
                              notifyAction(
                                `Removed staff access for ${staff.displayName}.`
                              );
                            }}
                            className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStaffUid(null)}
                            className="px-2 py-1 rounded border border-neutral-200 text-[11px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteStaffUid(staff.uid)}
                          aria-label="Remove staff member"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* USERS & RBAC */}
      {tab === 'users' && isBootstrappedSuperAdmin && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F6F7] border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Wallet / Orders</th>
                  <th className="py-3 px-4">Assigned Zone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((u) => {
                  const isSelfOrBoot =
                    u.uid === user.uid ||
                    u.email.toLowerCase() ===
                      BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                  const uOrdersCount = ordersByUserId.get(u.uid)?.length ?? 0;
                  return (
                    <tr key={u.uid}>
                      <td className="py-3 px-4 font-bold text-[#222222]">
                        {u.displayName}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {u.email || '—'}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {u.phone || '—'}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 tabular-nums">
                        ₹{(u.walletBalance || 0).toLocaleString('en-IN')} ·{' '}
                        {uOrdersCount} orders
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isSelfOrBoot}
                          value={u.franchiseZone}
                          onChange={(e) =>
                            adminUpdateUserRole(
                              u.uid,
                              u.email,
                              u.role,
                              e.target.value
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-[#F5F6F7] text-xs disabled:opacity-60"
                        >
                          <option value={u.franchiseZone}>
                            {u.franchiseZone}
                          </option>
                          <option value="All Zones">All Zones</option>
                          {zones
                            .filter((z) => z.name !== u.franchiseZone)
                            .map((z) => (
                              <option key={z.id} value={z.name}>
                                {z.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isSelfOrBoot}
                          value={u.role}
                          onChange={(e) =>
                            adminUpdateUserRole(
                              u.uid,
                              u.email,
                              e.target.value as UserRole,
                              u.franchiseZone
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-[#F5F6F7] text-xs font-semibold disabled:opacity-60"
                        >
                          <option value="customer">Customer</option>
                          <option value="partner">Partner</option>
                          <option value="franchise_admin">Franchise Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {u.role === 'customer' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomerUid(u.uid);
                                setTab('customers');
                              }}
                              className="px-2 py-1 rounded border border-neutral-200 hover:border-[#16A34A] text-[11px] font-semibold text-[#222222] inline-flex items-center gap-1"
                            >
                              <UserIcon className="w-3 h-3 text-[#16A34A]" />
                              <span>Details</span>
                            </button>
                          )}
                          {isSelfOrBoot ? (
                            <span className="text-[11px] text-neutral-400">
                              Protected
                            </span>
                          ) : confirmDeleteUserUid === u.uid ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await adminDeleteUser(u.uid);
                                  setConfirmDeleteUserUid(null);
                                  notifyAction(
                                    `Removed user ${
                                      u.email || u.phone || u.displayName
                                    }.`
                                  );
                                }}
                                className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-bold"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserUid(null)}
                                className="px-2 py-1 rounded border border-neutral-200 text-[11px]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserUid(u.uid)}
                              aria-label="Remove user"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
