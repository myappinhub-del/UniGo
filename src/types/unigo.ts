export type UserRole = 'customer' | 'partner' | 'franchise_admin' | 'super_admin';

export type WorkspaceMode = 'customer' | 'partner' | 'admin';

export type CustomerTab = 'home' | 'categories' | 'orders' | 'cart' | 'account';

export type ServiceViewKey =
  | 'overview'
  | 'food'
  | 'grocery'
  | 'shopping'
  | 'rides'
  | 'services'
  | 'rentals'
  | 'parcel';

export type CatalogVertical =
  | 'restaurant'
  | 'dish'
  | 'grocery'
  | 'shopping'
  | 'service'
  | 'rental';

export type OrderVertical =
  | 'food'
  | 'grocery'
  | 'shopping'
  | 'ride'
  | 'service'
  | 'parcel'
  | 'rental';

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'en_route'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface AddressEntry {
  id: string;
  label: string;
  fullAddress: string;
  zone: string;
  lat: number;
  lng: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  franchiseZone: string;
  walletBalance: number;
  savedAddresses: AddressEntry[];
  wishlistIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CatalogItem {
  id: string;
  vertical: CatalogVertical;
  title: string;
  subtitle?: string;
  category: string;
  parentId?: string;
  price: number;
  originalPrice?: number;
  rating: number;
  etaMinutes?: number;
  isVeg?: boolean;
  inStock: boolean;
  unitLabel?: string;
  specs?: string[];
  imageUrl?: string;
  franchiseZone: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  itemId: string;
  title: string;
  vertical: 'food' | 'grocery' | 'shopping';
  price: number;
  quantity: number;
  imageUrl?: string;
  unitLabel?: string;
  customizationSummary?: string;
  parentName?: string;
}

export interface OrderItemLine {
  itemId: string;
  title: string;
  quantity: number;
  price: number;
  customization?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  vertical: OrderVertical;
  status: OrderStatus;
  items?: OrderItemLine[];
  subtotal?: number;
  deliveryFee?: number;
  platformFee?: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'cod' | 'refunded';
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupCoords?: LatLngLiteral;
  deliveryCoords?: LatLngLiteral;
  distanceKm?: number;
  partnerId?: string;
  partnerName?: string;
  scheduledSlot?: string;
  notes?: string;
  franchiseZone: string;
  franchiseManagerUid?: string;
  opsAdminUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DispatchJobRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  vertical: OrderVertical;
  pickupArea: string;
  dropArea: string;
  pickupCoords?: LatLngLiteral;
  deliveryCoords?: LatLngLiteral;
  distanceKm?: number;
  payoutAmount: number;
  status: 'open' | 'accepted' | 'en_route' | 'completed' | 'cancelled';
  partnerId?: string;
  franchiseZone: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PartnerProfile {
  uid: string;
  name: string;
  vehicleType: 'bike' | 'auto' | 'car' | 'van' | 'technician';
  phone?: string;
  franchiseZone: string;
  isOnline: boolean;
  rating: number;
  completedJobs: number;
  totalEarnings: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'ride' | 'promo' | 'system';
  orderId?: string;
  read: boolean;
  createdAt?: unknown;
}

export interface FranchiseZone {
  id: string;
  name: string;
  city: string;
  managerEmail: string;
  managerUid?: string;
  opsAdminUid?: string;
  commissionRate: number;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  boundaryMode?: 'radius' | 'polygon';
  boundaryPoints?: LatLngLiteral[];
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffAccount {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: 'partner' | 'franchise_admin' | 'super_admin';
  franchiseZone: string;
  vehicleType?: PartnerProfile['vehicleType'];
  active: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AdTargetVertical =
  | 'food'
  | 'grocery'
  | 'shopping'
  | 'rides'
  | 'services'
  | 'rentals'
  | 'parcel';

export interface AdBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  targetVertical: AdTargetVertical;
  promoCode?: string;
  imageUrl?: string;
  badgeText?: string;
  franchiseZone: string;
  priority: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

