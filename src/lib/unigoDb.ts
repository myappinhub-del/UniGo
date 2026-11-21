import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  getSecondaryAuth,
  googleAuthProvider,
  handleFirestoreError,
} from './firebase';
import {
  AdBanner,
  CatalogItem,
  DispatchJobRecord,
  FranchiseZone,
  LatLngLiteral,
  NotificationItem,
  OrderRecord,
  OrderStatus,
  OrderVertical,
  PartnerProfile,
  StaffAccount,
  UserProfile,
  UserRole,
} from '../types/unigo';
import { DEFAULT_LOCATIONS, SEED_ADS, SEED_CATALOG, SEED_ZONES } from '../data/seedCatalog';
import { syncToSupabase } from './supabaseBridge';

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).replace(/[^a-zA-Z0-9]/g, 'x');
  return `${prefix}_${Date.now()}_${rand}`;
}

function getCreatedAtMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

export async function syncUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
}): Promise<UserProfile> {
  const userRef = doc(db, 'users', params.uid);
  const cleanEmail = (params.email || '').trim().slice(0, 200);
  const cleanPhone = (params.phoneNumber || '').trim().slice(0, 24);
  const isBootAdmin =
    cleanEmail.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const patch: Record<string, unknown> = {};
      if (isBootAdmin && data.role !== 'super_admin') {
        patch.role = 'super_admin';
      }
      if (cleanPhone && !data.phone) {
        patch.phone = cleanPhone;
      }
      if (
        params.displayName &&
        params.displayName !== 'UniGo Customer' &&
        params.displayName !== 'UniGo User' &&
        (!data.displayName ||
          data.displayName === 'UniGo Customer' ||
          data.displayName === 'UniGo User')
      ) {
        patch.displayName = params.displayName.slice(0, 120);
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = serverTimestamp();
        await updateDoc(userRef, patch);
      }

      if (isBootAdmin && data.role !== 'super_admin') {
        await setDoc(doc(db, 'admins', params.uid), {
          uid: params.uid,
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        });
      }

      const finalUser: UserProfile = {
        ...data,
        role: isBootAdmin ? 'super_admin' : data.role,
        phone: (patch.phone as string | undefined) ?? data.phone,
        displayName: (patch.displayName as string | undefined) ?? data.displayName,
      };
      void syncToSupabase('upsert_user', {
        uid: finalUser.uid,
        email: finalUser.email,
        displayName: finalUser.displayName,
        phone: finalUser.phone,
        role: finalUser.role,
        franchiseZone: finalUser.franchiseZone,
        walletBalance: finalUser.walletBalance,
        savedAddresses: finalUser.savedAddresses,
        wishlistIds: finalUser.wishlistIds,
      });
      return finalUser;
    }

    let assignedRole: UserRole = isBootAdmin ? 'super_admin' : 'customer';
    let assignedName =
      params.displayName ||
      (cleanEmail ? cleanEmail.split('@')[0] : '') ||
      (cleanPhone ? `Customer ${cleanPhone.slice(-4)}` : 'UniGo Customer');
    let assignedZone = 'Indiranagar, Bengaluru';

    if (!isBootAdmin) {
      const staffSnap = await getDoc(doc(db, 'staff_directory', params.uid)).catch(() => null);
      if (staffSnap && staffSnap.exists()) {
        const staffData = staffSnap.data() as StaffAccount;
        if (staffData.active) {
          assignedRole = staffData.role;
          assignedName = staffData.displayName || assignedName;
          assignedZone = staffData.franchiseZone || assignedZone;
        }
      }
    }

    const newProfile: Record<string, unknown> = {
      uid: params.uid,
      email: cleanEmail,
      displayName: assignedName.slice(0, 120),
      phone: cleanPhone,
      role: assignedRole,
      franchiseZone: assignedZone,
      walletBalance: assignedRole === 'customer' ? 1500 : 0,
      savedAddresses: assignedRole === 'customer' ? DEFAULT_LOCATIONS.slice(0, 2) : [],
      wishlistIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    if (isBootAdmin) {
      await setDoc(doc(db, 'admins', params.uid), {
        uid: params.uid,
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    }

    if (assignedRole === 'customer') {
      const welcomeId = makeSafeId('ntf');
      await setDoc(doc(db, 'notifications', welcomeId), {
        userId: params.uid,
        title: 'Welcome to UniGo',
        body: 'Your account is active with ₹1,500 UniGo Pay promotional credit.',
        type: 'promo',
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    const createdUser: UserProfile = {
      uid: params.uid,
      email: String(newProfile.email),
      displayName: String(newProfile.displayName),
      phone: String(newProfile.phone),
      role: assignedRole,
      franchiseZone: assignedZone,
      walletBalance: assignedRole === 'customer' ? 1500 : 0,
      savedAddresses: assignedRole === 'customer' ? DEFAULT_LOCATIONS.slice(0, 2) : [],
      wishlistIds: [],
    };
    void syncToSupabase('upsert_user', { ...createdUser });
    return createdUser;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function seedInitialCatalogIfAdmin(): Promise<void> {
  try {
    const existingSnap = await getDocs(collection(db, 'catalog_items'));
    if (existingSnap.empty) {
      const batch = writeBatch(db);
      for (const item of SEED_CATALOG) {
        const ref = doc(db, 'catalog_items', item.id);
        batch.set(ref, {
          ...stripUndefined(item as unknown as Record<string, unknown>),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const zone of SEED_ZONES) {
        const zRef = doc(db, 'franchise_zones', zone.id);
        batch.set(zRef, {
          ...stripUndefined(zone as unknown as Record<string, unknown>),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    const existingAdsSnap = await getDocs(collection(db, 'ads'));
    if (existingAdsSnap.empty) {
      const adsBatch = writeBatch(db);
      for (const ad of SEED_ADS) {
        const aRef = doc(db, 'ads', ad.id);
        adsBatch.set(aRef, {
          ...stripUndefined(ad as unknown as Record<string, unknown>),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await adsBatch.commit();
    }
    void syncToSupabase('bulk_seed', {
      catalogItems: SEED_CATALOG,
      zones: SEED_ZONES,
      ads: SEED_ADS,
    });
  } catch (error) {
    console.warn('Catalog seed skipped or already populated:', error);
  }
}

export function subscribeCatalog(
  onData: (items: CatalogItem[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'catalog_items'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as CatalogItem), id: d.id }));
      onData(items);
    },
    (err) => {
      console.error('Catalog snapshot error:', err);
      onError?.(err);
    }
  );
}

export function subscribeZones(onData: (zones: FranchiseZone[]) => void) {
  return onSnapshot(
    collection(db, 'franchise_zones'),
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as FranchiseZone), id: d.id })));
    },
    (err) => {
      console.error('Zones snapshot error:', err);
    }
  );
}

export function subscribeAds(onData: (ads: AdBanner[]) => void) {
  return onSnapshot(
    collection(db, 'ads'),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as AdBanner), id: d.id }))
        .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
      onData(rows);
    },
    (err) => {
      console.error('Ads snapshot error:', err);
    }
  );
}

export function subscribeUserOrders(
  uid: string,
  onData: (orders: OrderRecord[]) => void
) {
  const q = query(collection(db, 'orders'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as OrderRecord), id: d.id }))
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
    }
  );
}

export function subscribePartnerAssignedOrders(
  uid: string,
  onData: (orders: OrderRecord[]) => void
) {
  const q = query(collection(db, 'orders'), where('partnerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as OrderRecord), id: d.id }))
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
    }
  );
}

export function subscribeOpenDispatchJobs(onData: (jobs: DispatchJobRecord[]) => void) {
  const q = query(collection(db, 'dispatch_jobs'), where('status', '==', 'open'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as DispatchJobRecord), id: d.id }))
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'dispatch_jobs');
    }
  );
}

export function subscribeAllOrdersAdmin(onData: (orders: OrderRecord[]) => void) {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as OrderRecord), id: d.id })));
    },
    (err) => {
      console.warn('Admin orders snapshot skipped:', err);
    }
  );
}

export function subscribeFranchiseOrders(uid: string, onData: (orders: OrderRecord[]) => void) {
  const q = query(collection(db, 'orders'), where('franchiseManagerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as OrderRecord), id: d.id }))
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      console.warn('Franchise orders snapshot skipped:', err);
    }
  );
}

export function subscribeOpsAdminOrders(uid: string, onData: (orders: OrderRecord[]) => void) {
  const q = query(collection(db, 'orders'), where('opsAdminUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as OrderRecord), id: d.id }))
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      console.warn('Ops Admin orders snapshot skipped:', err);
    }
  );
}

export function subscribeAllUsersAdmin(onData: (users: UserProfile[]) => void) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as UserProfile));
    },
    (err) => {
      console.warn('Admin users snapshot skipped:', err);
    }
  );
}

export function subscribeStaffDirectory(onData: (staff: StaffAccount[]) => void) {
  return onSnapshot(
    collection(db, 'staff_directory'),
    (snap) => {
      const rows = snap.docs
        .map((d) => d.data() as StaffAccount)
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      console.warn('Staff directory snapshot skipped:', err);
    }
  );
}

export function subscribeNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void
) {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ ...(d.data() as NotificationItem), id: d.id }))
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    }
  );
}

export function subscribePartnerProfile(
  uid: string,
  onData: (partner: PartnerProfile | null) => void
) {
  return onSnapshot(
    doc(db, 'partners', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as PartnerProfile) : null);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `partners/${uid}`);
    }
  );
}

export async function createOrderWithDispatch(params: {
  user: UserProfile;
  vertical: OrderVertical;
  items?: { itemId: string; title: string; quantity: number; price: number; customization?: string }[];
  subtotal?: number;
  deliveryFee?: number;
  platformFee?: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'cod';
  pickupAddress: string;
  deliveryAddress: string;
  pickupCoords?: LatLngLiteral;
  deliveryCoords?: LatLngLiteral;
  distanceKm?: number;
  scheduledSlot?: string;
  notes?: string;
}): Promise<string> {
  const orderId = makeSafeId('ord');
  const orderNumber = `UG-${Math.floor(100000 + Math.random() * 899999)}`;
  const orderZone = (params.user.franchiseZone || 'Indiranagar, Bengaluru').slice(0, 80);

  let franchiseManagerUid: string | undefined;
  let opsAdminUid: string | undefined;
  try {
    const zonesSnap = await getDocs(collection(db, 'franchise_zones'));
    const zoneFirstWord = orderZone.split(',')[0].trim().toLowerCase();
    const matchedZone = zonesSnap.docs
      .map((d) => d.data() as FranchiseZone)
      .find(
        (z) =>
          z.name.toLowerCase() === orderZone.toLowerCase() ||
          orderZone.toLowerCase().includes(z.name.toLowerCase()) ||
          z.name.toLowerCase().includes(zoneFirstWord)
      );
    if (matchedZone?.managerUid) franchiseManagerUid = matchedZone.managerUid;
    if (matchedZone?.opsAdminUid) opsAdminUid = matchedZone.opsAdminUid;
  } catch {
    // Non-fatal if zone routing metadata is not yet present
  }

  const cleanPickupCoords =
    params.pickupCoords &&
    Number.isFinite(params.pickupCoords.lat) &&
    Number.isFinite(params.pickupCoords.lng)
      ? { lat: Number(params.pickupCoords.lat), lng: Number(params.pickupCoords.lng) }
      : undefined;
  const cleanDeliveryCoords =
    params.deliveryCoords &&
    Number.isFinite(params.deliveryCoords.lat) &&
    Number.isFinite(params.deliveryCoords.lng)
      ? { lat: Number(params.deliveryCoords.lat), lng: Number(params.deliveryCoords.lng) }
      : undefined;

  const batch = writeBatch(db);

  const orderDoc = stripUndefined({
    orderNumber,
    userId: params.user.uid,
    userEmail: params.user.email.slice(0, 200),
    userName: params.user.displayName.slice(0, 120),
    vertical: params.vertical,
    status: 'placed',
    items: params.items?.slice(0, 50),
    subtotal: params.subtotal,
    deliveryFee: params.deliveryFee,
    platformFee: params.platformFee,
    tax: params.tax,
    discount: params.discount,
    total: Number(params.total.toFixed(2)),
    paymentMethod: params.paymentMethod.slice(0, 60),
    paymentStatus: params.paymentStatus,
    pickupAddress: params.pickupAddress.slice(0, 280),
    deliveryAddress: params.deliveryAddress.slice(0, 280),
    pickupCoords: cleanPickupCoords,
    deliveryCoords: cleanDeliveryCoords,
    distanceKm: params.distanceKm,
    partnerId: '',
    partnerName: '',
    scheduledSlot: params.scheduledSlot?.slice(0, 80),
    notes: params.notes?.slice(0, 400),
    franchiseZone: orderZone,
    franchiseManagerUid,
    opsAdminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const payout = Math.max(35, Math.round(params.total * 0.14 + (params.deliveryFee ?? 25)));
  const dispatchDoc = stripUndefined({
    orderId,
    orderNumber,
    customerId: params.user.uid,
    vertical: params.vertical,
    pickupArea: params.pickupAddress.slice(0, 160),
    dropArea: params.deliveryAddress.slice(0, 160),
    pickupCoords: cleanPickupCoords,
    deliveryCoords: cleanDeliveryCoords,
    distanceKm: params.distanceKm ?? 3.2,
    payoutAmount: payout,
    status: 'open',
    partnerId: '',
    franchiseZone: orderZone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const notifId = makeSafeId('ntf');
  const notifDoc = {
    userId: params.user.uid,
    title: `${params.vertical.toUpperCase()} Order ${orderNumber} Placed`,
    body: `Total ₹${params.total.toLocaleString('en-IN')} via ${params.paymentMethod}. Searching nearby UniGo partner.`,
    type: params.vertical === 'ride' ? 'ride' : 'order',
    orderId,
    read: false,
    createdAt: serverTimestamp(),
  };

  batch.set(doc(db, 'orders', orderId), orderDoc);
  batch.set(doc(db, 'dispatch_jobs', orderId), dispatchDoc);
  batch.set(doc(db, 'notifications', notifId), notifDoc);

  try {
    await batch.commit();
    void syncToSupabase('create_order', {
      order: { ...orderDoc, id: orderId },
      dispatchJob: { ...dispatchDoc, id: orderId },
      notification: { ...notifDoc, id: notifId },
    });
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${orderId}`);
  }
}

export async function cancelPlacedOrder(orderId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', orderId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'dispatch_jobs', orderId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    void syncToSupabase('cancel_order', { orderId });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function toggleWishlistItem(user: UserProfile, itemId: string): Promise<string[]> {
  const exists = user.wishlistIds.includes(itemId);
  const next = exists
    ? user.wishlistIds.filter((id) => id !== itemId)
    : [...user.wishlistIds, itemId].slice(0, 100);
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      wishlistIds: next,
      updatedAt: serverTimestamp(),
    });
    void syncToSupabase('update_user_fields', { uid: user.uid, wishlistIds: next });
    return next;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export async function saveUserAddresses(user: UserProfile, savedAddresses: UserProfile['savedAddresses']) {
  try {
    const cleanAddresses = savedAddresses.slice(0, 10);
    const nextZone = cleanAddresses[0]?.zone || user.franchiseZone;
    await updateDoc(doc(db, 'users', user.uid), {
      savedAddresses: cleanAddresses,
      franchiseZone: nextZone,
      updatedAt: serverTimestamp(),
    });
    void syncToSupabase('update_user_fields', {
      uid: user.uid,
      savedAddresses: cleanAddresses,
      franchiseZone: nextZone,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export async function updateCustomerProfileInfo(
  uid: string,
  updates: { displayName: string; phone: string }
): Promise<void> {
  const cleanName = updates.displayName.trim().slice(0, 120);
  const cleanPhone = updates.phone.trim().slice(0, 24);
  if (!cleanName) {
    throw new Error('Full name is required.');
  }
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: cleanName,
      phone: cleanPhone,
      updatedAt: serverTimestamp(),
    });
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await updateProfile(auth.currentUser, { displayName: cleanName }).catch(() => {});
    }
    void syncToSupabase('update_user_fields', {
      uid,
      displayName: cleanName,
      phone: cleanPhone,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateSuperAdminPassword(newPassword: string): Promise<string> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email) {
    throw new Error('Sign in with your Super Admin account first.');
  }
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const hasPasswordProvider = fbUser.providerData.some(
    (p) => p.providerId === 'password'
  );

  try {
    if (hasPasswordProvider) {
      await updatePassword(fbUser, newPassword);
      return `Password updated for ${fbUser.email}.`;
    }
    const credential = EmailAuthProvider.credential(fbUser.email, newPassword);
    await linkWithCredential(fbUser, credential);
    if (!fbUser.emailVerified) {
      await sendEmailVerification(fbUser).catch(() => {});
    }
    return `Email & password login linked for ${fbUser.email}.`;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/requires-recent-login') {
      await reauthenticateWithPopup(fbUser, googleAuthProvider);
      if (hasPasswordProvider) {
        await updatePassword(fbUser, newPassword);
        return `Password updated for ${fbUser.email}.`;
      }
      const credential = EmailAuthProvider.credential(fbUser.email, newPassword);
      await linkWithCredential(fbUser, credential);
      return `Email & password login linked for ${fbUser.email}.`;
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password sign-in is disabled in Firebase Console. Enable Authentication -> Sign-in method -> Email/Password first.'
      );
    }
    if (code === 'auth/provider-already-linked') {
      await updatePassword(fbUser, newPassword);
      return `Password updated for ${fbUser.email}.`;
    }
    throw new Error(
      err instanceof Error ? err.message : 'Unable to update Super Admin password.'
    );
  }
}

export async function upsertPartnerProfile(params: {
  uid: string;
  name: string;
  vehicleType: PartnerProfile['vehicleType'];
  phone: string;
  franchiseZone: string;
  isOnline: boolean;
  existing: PartnerProfile | null;
}) {
  const ref = doc(db, 'partners', params.uid);
  try {
    if (!params.existing) {
      await setDoc(ref, {
        uid: params.uid,
        name: params.name.slice(0, 120),
        vehicleType: params.vehicleType,
        phone: params.phone.slice(0, 24),
        franchiseZone: params.franchiseZone.slice(0, 80),
        isOnline: params.isOnline,
        rating: 4.9,
        completedJobs: 0,
        totalEarnings: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: params.name.slice(0, 120),
        vehicleType: params.vehicleType,
        phone: params.phone.slice(0, 24),
        franchiseZone: params.franchiseZone.slice(0, 80),
        isOnline: params.isOnline,
        updatedAt: serverTimestamp(),
      });
    }
    void syncToSupabase('upsert_partner', {
      partner: {
        uid: params.uid,
        name: params.name.slice(0, 120),
        vehicleType: params.vehicleType,
        phone: params.phone.slice(0, 24),
        franchiseZone: params.franchiseZone.slice(0, 80),
        isOnline: params.isOnline,
        rating: params.existing?.rating ?? 4.9,
        completedJobs: params.existing?.completedJobs ?? 0,
        totalEarnings: params.existing?.totalEarnings ?? 0,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `partners/${params.uid}`);
  }
}

export async function acceptDispatchJob(params: {
  job: DispatchJobRecord;
  partner: PartnerProfile;
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'dispatch_jobs', params.job.orderId), {
    partnerId: params.partner.uid,
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'orders', params.job.orderId), {
    partnerId: params.partner.uid,
    partnerName: params.partner.name.slice(0, 120),
    status: 'confirmed',
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    const notifId = makeSafeId('ntf');
    const notifPayload = {
      id: notifId,
      userId: params.job.customerId,
      title: `Partner Assigned · ${params.job.orderNumber}`,
      body: `${params.partner.name} has accepted your ${params.job.vertical} request and is heading to pickup.`,
      type: params.job.vertical === 'ride' ? 'ride' : 'order',
      orderId: params.job.orderId,
      read: false,
    };
    await setDoc(doc(db, 'notifications', notifId), {
      userId: notifPayload.userId,
      title: notifPayload.title,
      body: notifPayload.body,
      type: notifPayload.type,
      orderId: notifPayload.orderId,
      read: false,
      createdAt: serverTimestamp(),
    }).catch(() => {});
    void syncToSupabase('accept_dispatch', {
      orderId: params.job.orderId,
      partnerUid: params.partner.uid,
      partnerName: params.partner.name.slice(0, 120),
      notification: notifPayload,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dispatch_jobs/${params.job.orderId}`);
  }
}

export async function partnerAdvanceOrder(params: {
  order: OrderRecord;
  nextStatus: OrderStatus;
  partner: PartnerProfile;
  payoutAmount: number;
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', params.order.id), {
    status: params.nextStatus,
    updatedAt: serverTimestamp(),
  });

  const jobStatus =
    params.nextStatus === 'delivered' || params.nextStatus === 'completed'
      ? 'completed'
      : 'en_route';

  batch.update(doc(db, 'dispatch_jobs', params.order.id), {
    status: jobStatus,
    updatedAt: serverTimestamp(),
  });

  if (jobStatus === 'completed') {
    batch.update(doc(db, 'partners', params.partner.uid), {
      completedJobs: params.partner.completedJobs + 1,
      totalEarnings: params.partner.totalEarnings + params.payoutAmount,
      updatedAt: serverTimestamp(),
    });
  }

  const notifId = makeSafeId('ntf');
  const notifPayload = {
    id: notifId,
    userId: params.order.userId,
    title: `Order ${params.order.orderNumber} ${params.nextStatus.replace('_', ' ')}`,
    body:
      jobStatus === 'completed'
        ? `Completed by ${params.partner.name}. Thank you for choosing UniGo.`
        : `Your partner ${params.partner.name} updated status to ${params.nextStatus.replace('_', ' ')}.`,
    type: params.order.vertical === 'ride' ? 'ride' : 'order',
    orderId: params.order.id,
    read: false,
  };

  batch.set(doc(db, 'notifications', notifId), {
    userId: notifPayload.userId,
    title: notifPayload.title,
    body: notifPayload.body,
    type: notifPayload.type,
    orderId: notifPayload.orderId,
    read: false,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    void syncToSupabase('advance_order', {
      orderId: params.order.id,
      nextStatus: params.nextStatus,
      jobStatus,
      partner: {
        ...params.partner,
        completedJobs:
          jobStatus === 'completed'
            ? params.partner.completedJobs + 1
            : params.partner.completedJobs,
        totalEarnings:
          jobStatus === 'completed'
            ? params.partner.totalEarnings + params.payoutAmount
            : params.partner.totalEarnings,
      },
      notification: notifPayload,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${params.order.id}`);
  }
}

export async function markNotificationRead(id: string) {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
    void syncToSupabase('mark_notification_read', { id });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

export async function adminUpsertCatalogItem(item: Omit<CatalogItem, 'createdAt' | 'updatedAt'>, isNew: boolean) {
  const ref = doc(db, 'catalog_items', item.id);
  const cleanItem = stripUndefined(item as unknown as Record<string, unknown>);
  try {
    if (isNew) {
      await setDoc(ref, {
        ...cleanItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...cleanItem,
        updatedAt: serverTimestamp(),
      });
    }
    void syncToSupabase('upsert_catalog', { item: cleanItem });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `catalog_items/${item.id}`);
  }
}

export async function adminDeleteCatalogItem(id: string) {
  try {
    await deleteDoc(doc(db, 'catalog_items', id));
    void syncToSupabase('delete_catalog', { id });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `catalog_items/${id}`);
  }
}

export async function adminUpdateOrderStatus(order: OrderRecord, status: OrderStatus) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', order.id), {
    status,
    updatedAt: serverTimestamp(),
  });
  const mappedJobStatus =
    status === 'delivered' || status === 'completed'
      ? 'completed'
      : status === 'cancelled'
      ? 'cancelled'
      : status === 'placed'
      ? 'open'
      : 'en_route';
  batch.update(doc(db, 'dispatch_jobs', order.id), {
    status: mappedJobStatus,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    void syncToSupabase('admin_update_order', {
      orderId: order.id,
      status,
      jobStatus: mappedJobStatus,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function adminDeleteOrder(orderId: string) {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
    await deleteDoc(doc(db, 'dispatch_jobs', orderId)).catch(() => {});
    void syncToSupabase('admin_delete_order', { orderId });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
  }
}

export async function adminUpdateUserRole(
  targetUid: string,
  email: string,
  role: UserRole,
  franchiseZone?: string
) {
  try {
    const updatePayload: Record<string, unknown> = {
      role,
      updatedAt: serverTimestamp(),
    };
    if (franchiseZone !== undefined) {
      updatePayload.franchiseZone = franchiseZone.slice(0, 80);
    }
    await updateDoc(doc(db, 'users', targetUid), updatePayload);
    if (role === 'super_admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        uid: targetUid,
        email,
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'franchise_admins', targetUid)).catch(() => {});
    } else if (role === 'franchise_admin') {
      await setDoc(doc(db, 'franchise_admins', targetUid), {
        uid: targetUid,
        email,
        franchiseZone: franchiseZone || 'Indiranagar Central',
        updatedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
    } else {
      await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
      await deleteDoc(doc(db, 'franchise_admins', targetUid)).catch(() => {});
    }
    void syncToSupabase('admin_update_user_role', {
      uid: targetUid,
      role,
      franchiseZone,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminDeleteUser(uid: string) {
  try {
    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'staff_directory', uid)).catch(() => {});
    await deleteDoc(doc(db, 'partners', uid)).catch(() => {});
    await deleteDoc(doc(db, 'franchise_admins', uid)).catch(() => {});
    await deleteDoc(doc(db, 'admins', uid)).catch(() => {});
    void syncToSupabase('admin_delete_user', { uid });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}

export async function superAdminProvisionStaffAccount(params: {
  adminUid: string;
  displayName: string;
  email: string;
  phone?: string;
  password: string;
  role: StaffAccount['role'];
  franchiseZone: string;
  vehicleType?: PartnerProfile['vehicleType'];
}): Promise<StaffAccount> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.displayName.trim();
  const cleanPhone = (params.phone || '').trim().slice(0, 24);
  const cleanZone = params.franchiseZone.trim() || 'Indiranagar, Bengaluru';
  const secondaryAuth = getSecondaryAuth();

  let staffUid = '';
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, params.password);
    staffUid = cred.user.uid;
    await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password sign-in is disabled in Firebase Console. Enable Authentication -> Sign-in method -> Email/Password first.'
      );
    }
    if (code === 'auth/email-already-in-use') {
      throw new Error('This email address already has a UniGo login account.');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters.');
    }
    throw new Error(err instanceof Error ? err.message : 'Unable to create login credentials.');
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }

  const batch = writeBatch(db);
  const staffRecord: Record<string, unknown> = stripUndefined({
    uid: staffUid,
    email: cleanEmail.slice(0, 200),
    displayName: cleanName.slice(0, 120),
    phone: cleanPhone,
    role: params.role,
    franchiseZone: cleanZone.slice(0, 80),
    vehicleType: params.role === 'partner' ? params.vehicleType || 'bike' : undefined,
    active: true,
    createdBy: params.adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'staff_directory', staffUid), staffRecord);
  batch.set(doc(db, 'users', staffUid), {
    uid: staffUid,
    email: cleanEmail.slice(0, 200),
    displayName: cleanName.slice(0, 120),
    phone: cleanPhone,
    role: params.role,
    franchiseZone: cleanZone.slice(0, 80),
    walletBalance: 0,
    savedAddresses: [],
    wishlistIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (params.role === 'partner') {
    batch.set(doc(db, 'partners', staffUid), {
      uid: staffUid,
      name: cleanName.slice(0, 120),
      vehicleType: params.vehicleType || 'bike',
      phone: cleanPhone,
      franchiseZone: cleanZone.slice(0, 80),
      isOnline: false,
      rating: 4.9,
      completedJobs: 0,
      totalEarnings: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (params.role === 'franchise_admin') {
    batch.set(doc(db, 'franchise_admins', staffUid), {
      uid: staffUid,
      email: cleanEmail,
      franchiseZone: cleanZone,
      updatedAt: serverTimestamp(),
    });
  } else if (params.role === 'super_admin') {
    batch.set(doc(db, 'admins', staffUid), {
      uid: staffUid,
      email: cleanEmail,
      updatedAt: serverTimestamp(),
    });
  }

  // Link franchise_zones routing fields for existing Firestore zones
  try {
    const zonesSnap = await getDocs(collection(db, 'franchise_zones'));
    const zoneFirstWord = cleanZone.split(',')[0].trim().toLowerCase();
    for (const zDoc of zonesSnap.docs) {
      const z = zDoc.data() as FranchiseZone;
      const matchesZone =
        cleanZone === 'All Zones' ||
        z.name.toLowerCase() === cleanZone.toLowerCase() ||
        cleanZone.toLowerCase().includes(z.name.toLowerCase()) ||
        z.name.toLowerCase().includes(zoneFirstWord);

      if (params.role === 'franchise_admin' && matchesZone) {
        batch.update(doc(db, 'franchise_zones', zDoc.id), {
          managerUid: staffUid,
          managerEmail: cleanEmail,
          updatedAt: serverTimestamp(),
        });
      } else if (params.role === 'super_admin' && matchesZone) {
        batch.update(doc(db, 'franchise_zones', zDoc.id), {
          opsAdminUid: staffUid,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch {
    // Zone routing assignment skipped if zones collection not yet seeded
  }

  try {
    await batch.commit();
    const staffOut: StaffAccount = {
      uid: staffUid,
      email: cleanEmail,
      displayName: cleanName,
      phone: cleanPhone,
      role: params.role,
      franchiseZone: cleanZone,
      vehicleType: params.role === 'partner' ? params.vehicleType || 'bike' : undefined,
      active: true,
      createdBy: params.adminUid,
    };
    void syncToSupabase('upsert_staff', {
      staff: staffOut,
      user: {
        uid: staffUid,
        email: cleanEmail.slice(0, 200),
        displayName: cleanName.slice(0, 120),
        phone: cleanPhone,
        role: params.role,
        franchiseZone: cleanZone.slice(0, 80),
        walletBalance: 0,
        savedAddresses: [],
        wishlistIds: [],
      },
      partner:
        params.role === 'partner'
          ? {
              uid: staffUid,
              name: cleanName.slice(0, 120),
              vehicleType: params.vehicleType || 'bike',
              phone: cleanPhone,
              franchiseZone: cleanZone.slice(0, 80),
              isOnline: false,
              rating: 4.9,
              completedJobs: 0,
              totalEarnings: 0,
            }
          : undefined,
    });
    return staffOut;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staff_directory/${staffUid}`);
  }
}

export async function adminUpdateStaffAccount(
  staff: StaffAccount,
  updates: {
    displayName: string;
    phone?: string;
    role: StaffAccount['role'];
    franchiseZone: string;
    vehicleType?: PartnerProfile['vehicleType'];
    active: boolean;
  }
): Promise<void> {
  const cleanName = updates.displayName.trim().slice(0, 120);
  const cleanPhone = (updates.phone ?? staff.phone ?? '').trim().slice(0, 24);
  const cleanZone = updates.franchiseZone.trim().slice(0, 80) || 'Indiranagar Central';

  try {
    const staffUpdate: Record<string, unknown> = {
      displayName: cleanName,
      phone: cleanPhone,
      role: updates.role,
      franchiseZone: cleanZone,
      active: updates.active,
      updatedAt: serverTimestamp(),
    };
    if (updates.role === 'partner') {
      staffUpdate.vehicleType = updates.vehicleType || 'bike';
    } else {
      staffUpdate.vehicleType = deleteField();
    }

    await updateDoc(doc(db, 'staff_directory', staff.uid), staffUpdate);

    await updateDoc(doc(db, 'users', staff.uid), {
      displayName: cleanName,
      phone: cleanPhone,
      role: updates.active ? updates.role : 'customer',
      franchiseZone: cleanZone,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    if (updates.role === 'partner') {
      const pRef = doc(db, 'partners', staff.uid);
      const pSnap = await getDoc(pRef).catch(() => null);
      if (pSnap && pSnap.exists()) {
        await updateDoc(pRef, {
          name: cleanName,
          phone: cleanPhone,
          vehicleType: updates.vehicleType || 'bike',
          franchiseZone: cleanZone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(pRef, {
          uid: staff.uid,
          name: cleanName,
          phone: cleanPhone,
          vehicleType: updates.vehicleType || 'bike',
          franchiseZone: cleanZone,
          isOnline: false,
          rating: 4.9,
          completedJobs: 0,
          totalEarnings: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await deleteDoc(doc(db, 'admins', staff.uid)).catch(() => {});
      await deleteDoc(doc(db, 'franchise_admins', staff.uid)).catch(() => {});
    } else if (updates.role === 'franchise_admin') {
      if (updates.active) {
        await setDoc(doc(db, 'franchise_admins', staff.uid), {
          uid: staff.uid,
          email: staff.email,
          franchiseZone: cleanZone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'franchise_admins', staff.uid)).catch(() => {});
      }
      await deleteDoc(doc(db, 'admins', staff.uid)).catch(() => {});
    } else if (updates.role === 'super_admin') {
      if (updates.active) {
        await setDoc(doc(db, 'admins', staff.uid), {
          uid: staff.uid,
          email: staff.email,
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', staff.uid)).catch(() => {});
      }
      await deleteDoc(doc(db, 'franchise_admins', staff.uid)).catch(() => {});
    }

    // Re-sync franchise_zones managerUid / opsAdminUid
    const zonesSnap = await getDocs(collection(db, 'franchise_zones')).catch(() => null);
    if (zonesSnap) {
      const zoneFirstWord = cleanZone.split(',')[0].trim().toLowerCase();
      for (const zDoc of zonesSnap.docs) {
        const z = zDoc.data() as FranchiseZone;
        const matchesZone =
          cleanZone === 'All Zones' ||
          z.name.toLowerCase() === cleanZone.toLowerCase() ||
          cleanZone.toLowerCase().includes(z.name.toLowerCase()) ||
          z.name.toLowerCase().includes(zoneFirstWord);

        if (updates.role === 'franchise_admin' && matchesZone && updates.active) {
          await updateDoc(doc(db, 'franchise_zones', zDoc.id), {
            managerUid: staff.uid,
            managerEmail: staff.email,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        } else if (z.managerUid === staff.uid) {
          await updateDoc(doc(db, 'franchise_zones', zDoc.id), {
            managerUid: '',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    }
    void syncToSupabase('upsert_staff', {
      staff: {
        uid: staff.uid,
        email: staff.email,
        displayName: cleanName,
        phone: cleanPhone,
        role: updates.role,
        franchiseZone: cleanZone,
        vehicleType: updates.role === 'partner' ? updates.vehicleType || 'bike' : undefined,
        active: updates.active,
        createdBy: staff.createdBy,
      },
      user: {
        uid: staff.uid,
        email: staff.email,
        displayName: cleanName,
        phone: cleanPhone,
        role: updates.active ? updates.role : 'customer',
        franchiseZone: cleanZone,
        walletBalance: 0,
      },
      partner:
        updates.role === 'partner'
          ? {
              uid: staff.uid,
              name: cleanName,
              phone: cleanPhone,
              vehicleType: updates.vehicleType || 'bike',
              franchiseZone: cleanZone,
              isOnline: false,
            }
          : undefined,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `staff_directory/${staff.uid}`);
  }
}

export async function adminSendStaffPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function adminDeleteStaffAccount(staff: StaffAccount): Promise<void> {
  try {
    await deleteDoc(doc(db, 'staff_directory', staff.uid));
    await deleteDoc(doc(db, 'users', staff.uid)).catch(() => {});
    await deleteDoc(doc(db, 'partners', staff.uid)).catch(() => {});
    await deleteDoc(doc(db, 'franchise_admins', staff.uid)).catch(() => {});
    await deleteDoc(doc(db, 'admins', staff.uid)).catch(() => {});

    const zonesSnap = await getDocs(collection(db, 'franchise_zones')).catch(() => null);
    if (zonesSnap) {
      for (const zDoc of zonesSnap.docs) {
        const z = zDoc.data() as FranchiseZone;
        if (z.managerUid === staff.uid || z.opsAdminUid === staff.uid) {
          await updateDoc(doc(db, 'franchise_zones', zDoc.id), {
            managerUid: z.managerUid === staff.uid ? '' : z.managerUid ?? '',
            opsAdminUid: z.opsAdminUid === staff.uid ? '' : z.opsAdminUid ?? '',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    }
    void syncToSupabase('delete_staff', { uid: staff.uid });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `staff_directory/${staff.uid}`);
  }
}

export async function adminToggleStaffActive(staff: StaffAccount, active: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'staff_directory', staff.uid), {
      active,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', staff.uid), {
      role: active ? staff.role : 'customer',
      updatedAt: serverTimestamp(),
    });
    if (staff.role === 'super_admin') {
      if (active) {
        await setDoc(doc(db, 'admins', staff.uid), {
          uid: staff.uid,
          email: staff.email,
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', staff.uid)).catch(() => {});
      }
    } else if (staff.role === 'franchise_admin') {
      if (active) {
        await setDoc(doc(db, 'franchise_admins', staff.uid), {
          uid: staff.uid,
          email: staff.email,
          franchiseZone: staff.franchiseZone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'franchise_admins', staff.uid)).catch(() => {});
      }
    }
    void syncToSupabase('upsert_staff', {
      staff: { ...staff, active },
      user: {
        uid: staff.uid,
        email: staff.email,
        displayName: staff.displayName,
        phone: staff.phone || '',
        role: active ? staff.role : 'customer',
        franchiseZone: staff.franchiseZone,
        walletBalance: 0,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `staff_directory/${staff.uid}`);
  }
}

export async function adminUpsertFranchiseZone(
  zone: Omit<FranchiseZone, 'createdAt' | 'updatedAt'>,
  isNew: boolean
) {
  const ref = doc(db, 'franchise_zones', zone.id);
  const cleanBoundaryPoints =
    Array.isArray(zone.boundaryPoints) && zone.boundaryPoints.length > 0
      ? zone.boundaryPoints.slice(0, 25).map((pt) => ({
          lat: Number(pt.lat.toFixed(6)),
          lng: Number(pt.lng.toFixed(6)),
        }))
      : [];

  const payload = stripUndefined({
    ...(zone as unknown as Record<string, unknown>),
    centerLat:
      typeof zone.centerLat === 'number' && Number.isFinite(zone.centerLat)
        ? Number(zone.centerLat.toFixed(6))
        : undefined,
    centerLng:
      typeof zone.centerLng === 'number' && Number.isFinite(zone.centerLng)
        ? Number(zone.centerLng.toFixed(6))
        : undefined,
    radiusKm:
      typeof zone.radiusKm === 'number' && Number.isFinite(zone.radiusKm)
        ? Math.min(150, Math.max(0.2, Number(zone.radiusKm.toFixed(2))))
        : undefined,
    boundaryMode: zone.boundaryMode || 'radius',
    boundaryPoints: cleanBoundaryPoints,
  });

  try {
    if (isNew) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
    void syncToSupabase('upsert_zone', { zone: payload });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `franchise_zones/${zone.id}`);
  }
}

export async function adminDeleteFranchiseZone(zoneId: string) {
  try {
    await deleteDoc(doc(db, 'franchise_zones', zoneId));
    void syncToSupabase('delete_zone', { id: zoneId });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `franchise_zones/${zoneId}`);
  }
}

export async function adminUpsertAd(
  ad: Omit<AdBanner, 'createdAt' | 'updatedAt'>,
  isNew: boolean
) {
  const ref = doc(db, 'ads', ad.id);
  const payload = stripUndefined({
    id: ad.id,
    title: ad.title.trim().slice(0, 140),
    subtitle: ad.subtitle.trim().slice(0, 240),
    ctaLabel: ad.ctaLabel.trim().slice(0, 40),
    targetVertical: ad.targetVertical,
    promoCode: ad.promoCode ? ad.promoCode.trim().toUpperCase().slice(0, 30) : '',
    imageUrl: ad.imageUrl ? ad.imageUrl.trim().slice(0, 500) : '',
    badgeText: ad.badgeText ? ad.badgeText.trim().slice(0, 40) : '',
    franchiseZone: ad.franchiseZone.trim().slice(0, 80) || 'All Zones',
    priority: Math.min(100, Math.max(1, Math.round(Number(ad.priority) || 1))),
    isActive: Boolean(ad.isActive),
  });

  try {
    if (isNew) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
    void syncToSupabase('upsert_ad', { ad: payload });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `ads/${ad.id}`);
  }
}

export async function adminDeleteAd(adId: string) {
  try {
    await deleteDoc(doc(db, 'ads', adId));
    void syncToSupabase('delete_ad', { id: adId });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `ads/${adId}`);
  }
}
