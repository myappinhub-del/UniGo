import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
  } catch {
    return null;
  }

  const nextKey = `${url}::${key.slice(0, 12)}`;
  if (!cachedClient || cachedConfigKey !== nextKey) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = nextKey;
  }
  return cachedClient;
}

export interface SupabaseSyncUser {
  uid: string;
  email?: string;
  displayName: string;
  phone?: string;
  role: 'customer' | 'partner' | 'franchise_admin' | 'super_admin';
  franchiseZone?: string;
  walletBalance?: number;
  savedAddresses?: unknown[];
  wishlistIds?: string[];
}

export async function sbUpsertUser(user: SupabaseSyncUser) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('users').upsert(
    {
      uid: user.uid,
      email: (user.email || '').slice(0, 200),
      display_name: user.displayName.slice(0, 120),
      phone: (user.phone || '').slice(0, 24),
      role: user.role,
      franchise_zone: (user.franchiseZone || 'Indiranagar, Bengaluru').slice(0, 80),
      wallet_balance: typeof user.walletBalance === 'number' ? user.walletBalance : 1500,
      saved_addresses: Array.isArray(user.savedAddresses) ? user.savedAddresses.slice(0, 10) : [],
      wishlist_ids: Array.isArray(user.wishlistIds) ? user.wishlistIds.slice(0, 100) : [],
    },
    { onConflict: 'uid' }
  );
  if (error) throw new Error(error.message);
}

export async function sbUpdateUserFields(
  uid: string,
  fields: Partial<{
    displayName: string;
    phone: string;
    franchiseZone: string;
    savedAddresses: unknown[];
    wishlistIds: string[];
    role: 'customer' | 'partner' | 'franchise_admin' | 'super_admin';
  }>
) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const patch: Record<string, unknown> = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName.slice(0, 120);
  if (fields.phone !== undefined) patch.phone = fields.phone.slice(0, 24);
  if (fields.franchiseZone !== undefined) patch.franchise_zone = fields.franchiseZone.slice(0, 80);
  if (fields.savedAddresses !== undefined) patch.saved_addresses = fields.savedAddresses.slice(0, 10);
  if (fields.wishlistIds !== undefined) patch.wishlist_ids = fields.wishlistIds.slice(0, 100);
  if (fields.role !== undefined) patch.role = fields.role;
  if (Object.keys(patch).length === 0) return;

  const { error } = await sb.from('users').update(patch).eq('uid', uid);
  if (error) throw new Error(error.message);
}

export async function sbDeleteUserCascade(uid: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb.from('staff_directory').delete().eq('uid', uid);
  await sb.from('partners').delete().eq('uid', uid);
  const { error } = await sb.from('users').delete().eq('uid', uid);
  if (error) throw new Error(error.message);
}

export async function sbUpsertCatalogItems(items: Record<string, unknown>[]) {
  const sb = getSupabaseAdmin();
  if (!sb || items.length === 0) return;
  const rows = items.map((item) => ({
    id: String(item.id),
    vertical: String(item.vertical),
    title: String(item.title || '').slice(0, 140),
    subtitle: item.subtitle ? String(item.subtitle).slice(0, 240) : null,
    category: String(item.category || 'General').slice(0, 80),
    parent_id: item.parentId ? String(item.parentId).slice(0, 128) : null,
    price: Number(item.price || 0),
    original_price: item.originalPrice !== undefined ? Number(item.originalPrice) : null,
    rating: Number(item.rating ?? 4.5),
    eta_minutes: item.etaMinutes !== undefined ? Math.round(Number(item.etaMinutes)) : null,
    is_veg: typeof item.isVeg === 'boolean' ? item.isVeg : null,
    in_stock: Boolean(item.inStock ?? true),
    unit_label: item.unitLabel ? String(item.unitLabel).slice(0, 40) : null,
    specs: Array.isArray(item.specs) ? item.specs.slice(0, 12) : [],
    image_url: item.imageUrl ? String(item.imageUrl).slice(0, 500) : null,
    franchise_zone: String(item.franchiseZone || 'All Zones').slice(0, 80),
  }));
  const { error } = await sb.from('catalog_items').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function sbDeleteCatalogItem(id: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('catalog_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function sbUpsertZones(zones: Record<string, unknown>[]) {
  const sb = getSupabaseAdmin();
  if (!sb || zones.length === 0) return;
  const rows = zones.map((z) => ({
    id: String(z.id),
    name: String(z.name || '').slice(0, 100),
    city: String(z.city || '').slice(0, 80),
    manager_email: String(z.managerEmail || '').slice(0, 200),
    manager_uid: z.managerUid ? String(z.managerUid).slice(0, 128) : null,
    ops_admin_uid: z.opsAdminUid ? String(z.opsAdminUid).slice(0, 128) : null,
    commission_rate: Number(z.commissionRate ?? 15),
    center_lat: typeof z.centerLat === 'number' ? z.centerLat : null,
    center_lng: typeof z.centerLng === 'number' ? z.centerLng : null,
    radius_km: typeof z.radiusKm === 'number' ? z.radiusKm : null,
    boundary_mode: z.boundaryMode === 'polygon' ? 'polygon' : 'radius',
    boundary_points: Array.isArray(z.boundaryPoints) ? z.boundaryPoints.slice(0, 25) : [],
    is_active: Boolean(z.isActive ?? true),
  }));
  const { error } = await sb.from('franchise_zones').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function sbDeleteZone(id: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('franchise_zones').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function sbUpsertAds(ads: Record<string, unknown>[]) {
  const sb = getSupabaseAdmin();
  if (!sb || ads.length === 0) return;
  const rows = ads.map((ad) => ({
    id: String(ad.id),
    title: String(ad.title || '').slice(0, 140),
    subtitle: String(ad.subtitle || '').slice(0, 240),
    cta_label: String(ad.ctaLabel || 'Explore').slice(0, 40),
    target_vertical: String(ad.targetVertical || 'food'),
    promo_code: ad.promoCode ? String(ad.promoCode).slice(0, 30) : null,
    image_url: ad.imageUrl ? String(ad.imageUrl).slice(0, 500) : null,
    badge_text: ad.badgeText ? String(ad.badgeText).slice(0, 40) : null,
    franchise_zone: String(ad.franchiseZone || 'All Zones').slice(0, 80),
    priority: Math.round(Number(ad.priority || 1)),
    is_active: Boolean(ad.isActive ?? true),
  }));
  const { error } = await sb.from('ads').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function sbDeleteAd(id: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('ads').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function sbUpsertStaff(staff: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('staff_directory').upsert(
    {
      uid: String(staff.uid),
      email: String(staff.email || '').slice(0, 200),
      display_name: String(staff.displayName || '').slice(0, 120),
      phone: staff.phone ? String(staff.phone).slice(0, 24) : '',
      role: String(staff.role),
      franchise_zone: String(staff.franchiseZone || 'Indiranagar, Bengaluru').slice(0, 80),
      vehicle_type: staff.vehicleType ? String(staff.vehicleType) : null,
      active: Boolean(staff.active ?? true),
      created_by: String(staff.createdBy || ''),
    },
    { onConflict: 'uid' }
  );
  if (error) throw new Error(error.message);
}

export async function sbDeleteStaff(uid: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('staff_directory').delete().eq('uid', uid);
  if (error) throw new Error(error.message);
}

export async function sbUpsertPartner(partner: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('partners').upsert(
    {
      uid: String(partner.uid),
      name: String(partner.name || '').slice(0, 120),
      vehicle_type: String(partner.vehicleType || 'bike'),
      phone: partner.phone ? String(partner.phone).slice(0, 24) : '',
      franchise_zone: String(partner.franchiseZone || 'Indiranagar, Bengaluru').slice(0, 80),
      is_online: Boolean(partner.isOnline ?? false),
      rating: Number(partner.rating ?? 4.9),
      completed_jobs: Math.round(Number(partner.completedJobs ?? 0)),
      total_earnings: Number(partner.totalEarnings ?? 0),
    },
    { onConflict: 'uid' }
  );
  if (error) throw new Error(error.message);
}

export async function sbUpsertOrder(order: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('orders').upsert(
    {
      id: String(order.id),
      order_number: String(order.orderNumber),
      user_id: String(order.userId),
      user_email: order.userEmail ? String(order.userEmail).slice(0, 200) : null,
      user_name: order.userName ? String(order.userName).slice(0, 120) : null,
      vertical: String(order.vertical),
      status: String(order.status),
      items: Array.isArray(order.items) ? order.items.slice(0, 50) : [],
      subtotal: order.subtotal !== undefined ? Number(order.subtotal) : null,
      delivery_fee: order.deliveryFee !== undefined ? Number(order.deliveryFee) : null,
      platform_fee: order.platformFee !== undefined ? Number(order.platformFee) : null,
      tax: order.tax !== undefined ? Number(order.tax) : null,
      discount: order.discount !== undefined ? Number(order.discount) : null,
      total: Number(order.total || 0),
      payment_method: String(order.paymentMethod || 'UPI').slice(0, 60),
      payment_status: String(order.paymentStatus || 'paid'),
      pickup_address: order.pickupAddress ? String(order.pickupAddress).slice(0, 280) : null,
      delivery_address: order.deliveryAddress ? String(order.deliveryAddress).slice(0, 280) : null,
      pickup_coords: order.pickupCoords ?? null,
      delivery_coords: order.deliveryCoords ?? null,
      distance_km: order.distanceKm !== undefined ? Number(order.distanceKm) : null,
      partner_id: order.partnerId ? String(order.partnerId).slice(0, 128) : null,
      partner_name: order.partnerName ? String(order.partnerName).slice(0, 120) : null,
      scheduled_slot: order.scheduledSlot ? String(order.scheduledSlot).slice(0, 80) : null,
      notes: order.notes ? String(order.notes).slice(0, 400) : null,
      franchise_zone: String(order.franchiseZone || 'Indiranagar, Bengaluru').slice(0, 80),
      franchise_manager_uid: order.franchiseManagerUid ? String(order.franchiseManagerUid) : null,
      ops_admin_uid: order.opsAdminUid ? String(order.opsAdminUid) : null,
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function sbUpdateOrderStatus(
  orderId: string,
  patch: Partial<{
    status: string;
    partnerId: string;
    partnerName: string;
  }>
) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const updateRow: Record<string, unknown> = {};
  if (patch.status !== undefined) updateRow.status = patch.status;
  if (patch.partnerId !== undefined) updateRow.partner_id = patch.partnerId;
  if (patch.partnerName !== undefined) updateRow.partner_name = patch.partnerName;
  if (Object.keys(updateRow).length === 0) return;
  const { error } = await sb.from('orders').update(updateRow).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function sbDeleteOrderCascade(orderId: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb.from('dispatch_jobs').delete().eq('id', orderId);
  const { error } = await sb.from('orders').delete().eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function sbUpsertDispatchJob(job: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('dispatch_jobs').upsert(
    {
      id: String(job.id || job.orderId),
      order_id: String(job.orderId),
      order_number: String(job.orderNumber),
      customer_id: String(job.customerId),
      vertical: String(job.vertical),
      pickup_area: String(job.pickupArea || '').slice(0, 160),
      drop_area: String(job.dropArea || '').slice(0, 160),
      pickup_coords: job.pickupCoords ?? null,
      delivery_coords: job.deliveryCoords ?? null,
      distance_km: job.distanceKm !== undefined ? Number(job.distanceKm) : null,
      payout_amount: Number(job.payoutAmount || 0),
      status: String(job.status || 'open'),
      partner_id: job.partnerId ? String(job.partnerId).slice(0, 128) : null,
      franchise_zone: String(job.franchiseZone || 'Indiranagar, Bengaluru').slice(0, 80),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function sbUpdateDispatchJob(
  jobId: string,
  patch: Partial<{ status: string; partnerId: string }>
) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const updateRow: Record<string, unknown> = {};
  if (patch.status !== undefined) updateRow.status = patch.status;
  if (patch.partnerId !== undefined) updateRow.partner_id = patch.partnerId;
  if (Object.keys(updateRow).length === 0) return;
  const { error } = await sb.from('dispatch_jobs').update(updateRow).eq('id', jobId);
  if (error) throw new Error(error.message);
}

export async function sbInsertNotification(notif: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('notifications').upsert(
    {
      id: String(notif.id),
      user_id: String(notif.userId),
      title: String(notif.title || '').slice(0, 120),
      body: String(notif.body || '').slice(0, 320),
      type: String(notif.type || 'system'),
      order_id: notif.orderId ? String(notif.orderId).slice(0, 128) : null,
      read: Boolean(notif.read ?? false),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function sbMarkNotificationRead(id: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw new Error(error.message);
}
