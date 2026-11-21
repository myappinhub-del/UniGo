import React, { useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Bell,
  ChevronDown,
  Home,
  LayoutGrid,
  LogOut,
  MapPin,
  PackageCheck,
  ShoppingBag,
  User as UserIcon,
} from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL, auth } from './lib/firebase';
import {
  markNotificationRead,
  saveUserAddresses,
  seedInitialCatalogIfAdmin,
  subscribeAds,
  subscribeAllOrdersAdmin,
  subscribeAllUsersAdmin,
  subscribeCatalog,
  subscribeFranchiseOrders,
  subscribeNotifications,
  subscribeOpenDispatchJobs,
  subscribeOpsAdminOrders,
  subscribePartnerAssignedOrders,
  subscribePartnerProfile,
  subscribeStaffDirectory,
  subscribeUserOrders,
  subscribeZones,
  syncUserProfile,
  toggleWishlistItem,
} from './lib/unigoDb';
import { DEFAULT_LOCATIONS, SEED_ADS, SEED_CATALOG, SEED_ZONES } from './data/seedCatalog';
import {
  AdBanner,
  AddressEntry,
  CartItem,
  CatalogItem,
  CustomerTab,
  DispatchJobRecord,
  FranchiseZone,
  NotificationItem,
  OrderRecord,
  PartnerProfile,
  ServiceViewKey,
  StaffAccount,
  UserProfile,
  WorkspaceMode,
} from './types/unigo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthModal } from './components/AuthModal';
import { LocationModal } from './components/LocationModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ErrandPlannerDrawer } from './components/ErrandPlannerDrawer';
import { HomeView } from './components/services/HomeView';
import { FoodView } from './components/services/FoodView';
import { GroceryView } from './components/services/GroceryView';
import { ShoppingView } from './components/services/ShoppingView';
import { RidesView } from './components/services/RidesView';
import { ServicesView } from './components/services/ServicesView';
import { RentalsView } from './components/services/RentalsView';
import { ParcelView } from './components/services/ParcelView';
import { CategoriesView } from './components/CategoriesView';
import { CartCheckoutView } from './components/CartCheckoutView';
import { OrdersView } from './components/OrdersView';
import { AccountView } from './components/AccountView';
import { PartnerPortalView } from './components/PartnerPortalView';
import { AdminPortalView } from './components/AdminPortalView';

const CART_STORAGE_KEY = 'unigo_cart_v1';

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('customer');
  const [activeTab, setActiveTab] = useState<CustomerTab>('home');
  const [serviceView, setServiceView] = useState<ServiceViewKey>('overview');
  const [preselectId, setPreselectId] = useState<string | undefined>(undefined);
  const [rideTier, setRideTier] = useState<'bike' | 'auto' | 'car'>('bike');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentLocation, setCurrentLocation] = useState<AddressEntry>(
    DEFAULT_LOCATIONS[0]
  );
  const [guestLocations, setGuestLocations] = useState<AddressEntry[]>(
    DEFAULT_LOCATIONS
  );

  const [firestoreCatalog, setFirestoreCatalog] = useState<CatalogItem[]>([]);
  const [firestoreZones, setFirestoreZones] = useState<FranchiseZone[]>([]);
  const [firestoreAds, setFirestoreAds] = useState<AdBanner[]>([]);
  const [userOrders, setUserOrders] = useState<OrderRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [openDispatchJobs, setOpenDispatchJobs] = useState<DispatchJobRecord[]>([]);
  const [partnerOrders, setPartnerOrders] = useState<OrderRecord[]>([]);

  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);

  const [cart, setCart] = useState<CartItem[]>(loadInitialCart);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [errandPlannerOpen, setErrandPlannerOpen] = useState(false);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota issues
    }
  }, [cart]);

  // Listen for Google Maps Platform quota exhaustion
  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Fetch public Maps JS API key from server
  useEffect(() => {
    let active = true;
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.googleMapsApiKey) {
          setMapsApiKey(String(data.googleMapsApiKey));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Subscribe to public Catalog, Zones, & Promotional Ads
  useEffect(() => {
    const unsubCat = subscribeCatalog(setFirestoreCatalog);
    const unsubZones = subscribeZones(setFirestoreZones);
    const unsubAds = subscribeAds(setFirestoreAds);
    return () => {
      unsubCat();
      unsubZones();
      unsubAds();
    };
  }, []);

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUserProfile(null);
        setUserOrders([]);
        setNotifications([]);
        setPartnerProfile(null);
        setOpenDispatchJobs([]);
        setPartnerOrders([]);
        setAdminOrders([]);
        setAdminUsers([]);
        setStaffList([]);
        setWorkspaceMode('customer');
        setAuthReady(true);
        return;
      }

      try {
        const profile = await syncUserProfile({
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || '',
          phoneNumber: fbUser.phoneNumber || '',
        });
        setUserProfile(profile);

        if (profile.role === 'partner') {
          setWorkspaceMode('partner');
        } else if (
          profile.role === 'franchise_admin' ||
          profile.role === 'super_admin'
        ) {
          setWorkspaceMode('admin');
        } else {
          setWorkspaceMode('customer');
        }

        if (profile.savedAddresses && profile.savedAddresses.length > 0) {
          setCurrentLocation(profile.savedAddresses[0]);
        }
        if (profile.role === 'super_admin' || profile.role === 'franchise_admin') {
          void seedInitialCatalogIfAdmin();
        }
      } catch (err) {
        console.error('Failed to sync profile:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Authenticated customer orders & notifications
  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsubOrders = subscribeUserOrders(userProfile.uid, setUserOrders);
    const unsubNotif = subscribeNotifications(userProfile.uid, setNotifications);
    return () => {
      unsubOrders();
      unsubNotif();
    };
  }, [userProfile?.uid]);

  // Partner console subscriptions
  useEffect(() => {
    if (!userProfile?.uid || workspaceMode !== 'partner') return;
    const unsubProfile = subscribePartnerProfile(userProfile.uid, setPartnerProfile);
    const unsubJobs = subscribeOpenDispatchJobs(setOpenDispatchJobs);
    const unsubAssigned = subscribePartnerAssignedOrders(
      userProfile.uid,
      setPartnerOrders
    );
    return () => {
      unsubProfile();
      unsubJobs();
      unsubAssigned();
    };
  }, [userProfile?.uid, workspaceMode]);

  // Admin & Franchise console subscriptions
  useEffect(() => {
    if (!userProfile?.uid || workspaceMode !== 'admin') return;
    const isBootAdmin =
      userProfile.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    if (isBootAdmin) {
      const unsubOrders = subscribeAllOrdersAdmin(setAdminOrders);
      const unsubUsers = subscribeAllUsersAdmin(setAdminUsers);
      const unsubStaff = subscribeStaffDirectory(setStaffList);
      return () => {
        unsubOrders();
        unsubUsers();
        unsubStaff();
      };
    }

    if (userProfile.role === 'franchise_admin') {
      const unsubOrders = subscribeFranchiseOrders(userProfile.uid, setAdminOrders);
      return () => {
        unsubOrders();
      };
    }

    if (userProfile.role === 'super_admin') {
      const unsubOrders = subscribeOpsAdminOrders(userProfile.uid, setAdminOrders);
      return () => {
        unsubOrders();
      };
    }
  }, [userProfile?.uid, userProfile?.email, userProfile?.role, workspaceMode]);

  const effectiveCatalog: CatalogItem[] = useMemo(() => {
    if (firestoreCatalog.length > 0) return firestoreCatalog;
    return SEED_CATALOG;
  }, [firestoreCatalog]);

  const effectiveZones: FranchiseZone[] = useMemo(() => {
    if (firestoreZones.length > 0) return firestoreZones;
    return SEED_ZONES;
  }, [firestoreZones]);

  const effectiveAds: AdBanner[] = useMemo(() => {
    if (firestoreAds.length > 0) return firestoreAds;
    return SEED_ADS;
  }, [firestoreAds]);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const activeRideOrder = useMemo(
    () =>
      userOrders.find(
        (o) =>
          o.vertical === 'ride' &&
          !['delivered', 'completed', 'cancelled'].includes(o.status)
      ),
    [userOrders]
  );

  const handleAddToCart = (
    item: CatalogItem,
    qtyDelta: number,
    customization?: string,
    parentName?: string
  ) => {
    const mappedVertical: CartItem['vertical'] =
      item.vertical === 'dish' || item.vertical === 'restaurant'
        ? 'food'
        : item.vertical === 'grocery'
        ? 'grocery'
        : 'shopping';

    setCart((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.itemId === item.id &&
          (c.customizationSummary || '') === (customization || '')
      );

      if (idx === -1) {
        if (qtyDelta <= 0) return prev;
        return [
          ...prev,
          {
            itemId: item.id,
            title: item.title,
            vertical: mappedVertical,
            price: item.price,
            quantity: qtyDelta,
            imageUrl: item.imageUrl,
            unitLabel: item.unitLabel,
            customizationSummary: customization,
            parentName,
          },
        ];
      }

      const nextQty = prev[idx].quantity + qtyDelta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((c, i) => (i === idx ? { ...c, quantity: nextQty } : c));
    });
  };

  const handleUpdateCartQty = (
    itemId: string,
    delta: number,
    customization?: string
  ) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (
            c.itemId === itemId &&
            (c.customizationSummary || '') === (customization || '')
          ) {
            return { ...c, quantity: c.quantity + delta };
          }
          return c;
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const handleToggleWishlist = async (itemId: string) => {
    if (!userProfile) {
      setAuthModalOpen(true);
      return;
    }
    const exists = userProfile.wishlistIds.includes(itemId);
    const optimistic = exists
      ? userProfile.wishlistIds.filter((id) => id !== itemId)
      : [...userProfile.wishlistIds, itemId];
    setUserProfile({ ...userProfile, wishlistIds: optimistic });
    try {
      await toggleWishlistItem(userProfile, itemId);
    } catch (err) {
      console.error('Wishlist update failed:', err);
    }
  };

  const handleAddLocation = async (entry: AddressEntry) => {
    if (userProfile) {
      const nextAddresses = [
        entry,
        ...userProfile.savedAddresses.filter((a) => a.id !== entry.id),
      ].slice(0, 10);
      setUserProfile({
        ...userProfile,
        savedAddresses: nextAddresses,
        franchiseZone: entry.zone,
      });
      await saveUserAddresses(userProfile, nextAddresses);
    } else {
      setGuestLocations((prev) => [entry, ...prev.slice(0, 5)]);
    }
  };

  const handleNavigateService = (view: ServiceViewKey, itemId?: string) => {
    setPreselectId(itemId);
    setServiceView(view);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderCreated = () => {
    setWorkspaceMode('customer');
    setServiceView('overview');
    setActiveTab('orders');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReorder = (order: OrderRecord) => {
    if (!order.items || order.items.length === 0) return;
    const vertical: CartItem['vertical'] =
      order.vertical === 'food'
        ? 'food'
        : order.vertical === 'grocery'
        ? 'grocery'
        : 'shopping';

    const rebuilt: CartItem[] = order.items.map((line) => {
      const matched = effectiveCatalog.find((c) => c.id === line.itemId);
      return {
        itemId: line.itemId,
        title: line.title,
        vertical,
        price: line.price,
        quantity: line.quantity,
        imageUrl: matched?.imageUrl,
        unitLabel: matched?.unitLabel,
        customizationSummary: line.customization,
      };
    });
    setCart(rebuilt);
    setActiveTab('cart');
    setServiceView('overview');
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setWorkspaceMode('customer');
    setActiveTab('home');
    setServiceView('overview');
  };

  const savedLocations = userProfile?.savedAddresses ?? guestLocations;

  const renderCustomerContent = () => {
    if (activeTab === 'categories') {
      return (
        <CategoriesView
          catalog={effectiveCatalog}
          onSelectService={(view) => handleNavigateService(view)}
          onSelectRideTier={(tier) => setRideTier(tier)}
        />
      );
    }

    if (activeTab === 'cart') {
      return (
        <CartCheckoutView
          cart={cart}
          user={userProfile}
          currentLocation={currentLocation}
          onUpdateQty={handleUpdateCartQty}
          onClearCart={() => setCart([])}
          onOpenLocationModal={() => setLocationModalOpen(true)}
          onRequireAuth={() => setAuthModalOpen(true)}
          onCheckoutComplete={handleOrderCreated}
          onBrowseHome={() => {
            setActiveTab('home');
            setServiceView('overview');
          }}
        />
      );
    }

    if (activeTab === 'orders') {
      return (
        <OrdersView
          orders={userOrders}
          mapsApiKey={mapsApiKey}
          isSignedIn={!!userProfile}
          onRequireAuth={() => setAuthModalOpen(true)}
          onReorder={handleReorder}
        />
      );
    }

    if (activeTab === 'account') {
      return (
        <AccountView
          user={userProfile}
          catalog={effectiveCatalog}
          onRequireAuth={() => setAuthModalOpen(true)}
          onSignOut={handleSignOut}
          onOpenLocationModal={() => setLocationModalOpen(true)}
          onAddToCart={(item, qty) => handleAddToCart(item, qty)}
          onProfileUpdated={(updated) => setUserProfile(updated)}
        />
      );
    }

    // activeTab === 'home'
    if (serviceView === 'food') {
      return (
        <FoodView
          catalog={effectiveCatalog}
          cart={cart}
          initialRestaurantId={preselectId}
          onAddToCart={handleAddToCart}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    if (serviceView === 'grocery') {
      return (
        <GroceryView
          catalog={effectiveCatalog}
          cart={cart}
          onAddToCart={handleAddToCart}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    if (serviceView === 'shopping') {
      return (
        <ShoppingView
          catalog={effectiveCatalog}
          cart={cart}
          wishlistIds={userProfile?.wishlistIds ?? []}
          initialProductId={preselectId}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    if (serviceView === 'rides') {
      return (
        <RidesView
          mapsApiKey={mapsApiKey}
          user={userProfile}
          currentLocation={currentLocation}
          initialTier={rideTier}
          activeRideOrder={activeRideOrder}
          onRequireAuth={() => setAuthModalOpen(true)}
          onOrderCreated={handleOrderCreated}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    if (serviceView === 'services') {
      return (
        <ServicesView
          catalog={effectiveCatalog}
          user={userProfile}
          currentLocation={currentLocation}
          initialServiceId={preselectId}
          onRequireAuth={() => setAuthModalOpen(true)}
          onBooked={handleOrderCreated}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    if (serviceView === 'rentals') {
      return (
        <RentalsView
          catalog={effectiveCatalog}
          user={userProfile}
          currentLocation={currentLocation}
          onRequireAuth={() => setAuthModalOpen(true)}
          onEnquirySubmitted={handleOrderCreated}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    if (serviceView === 'parcel') {
      return (
        <ParcelView
          mapsApiKey={mapsApiKey}
          user={userProfile}
          currentLocation={currentLocation}
          onRequireAuth={() => setAuthModalOpen(true)}
          onBooked={handleOrderCreated}
          onBackHome={() => setServiceView('overview')}
        />
      );
    }

    return (
      <HomeView
        catalog={effectiveCatalog}
        ads={effectiveAds}
        cart={cart}
        wishlistIds={userProfile?.wishlistIds ?? []}
        currentLocation={currentLocation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNavigateService={handleNavigateService}
        onAddToCart={(item, qty) => handleAddToCart(item, qty)}
        onToggleWishlist={handleToggleWishlist}
        onOpenErrandPlanner={() => setErrandPlannerOpen(true)}
        onSelectRideTier={(tier) => setRideTier(tier)}
      />
    );
  };

  const appShell = (
    <div className="min-h-screen bg-[#FFFFFF] text-[#222222] flex flex-col">
      {/* Tier 1/2 Google Maps Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Commercial Top App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Left Zone: Brand + Location Selector or Portal Identity */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (workspaceMode === 'customer') {
                  setActiveTab('home');
                  setServiceView('overview');
                }
              }}
              className="flex flex-col text-left shrink-0"
            >
              <span className="text-xl font-extrabold tracking-tight text-[#16A34A] font-display leading-none">
                UniGo
              </span>
              <span className="text-[10px] text-neutral-500 font-medium hidden sm:block mt-0.5">
                Everything. Everywhere.
              </span>
            </button>

            <div className="h-6 w-px bg-neutral-200 hidden sm:block shrink-0" />

            {workspaceMode === 'customer' ? (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="flex items-center gap-2 text-left min-w-0 max-w-[200px] sm:max-w-[260px] px-2 py-1.5 rounded-lg hover:bg-[#F5F6F7] transition-colors"
              >
                <MapPin className="w-4 h-4 text-[#16A34A] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#222222] flex items-center gap-1 truncate">
                    <span className="truncate">{currentLocation.label}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {currentLocation.fullAddress}
                  </div>
                </div>
              </button>
            ) : (
              <div className="min-w-0 px-2 py-1">
                <div className="text-xs font-bold text-[#222222] truncate">
                  {userProfile?.role === 'partner'
                    ? 'Partner Portal'
                    : userProfile?.role === 'franchise_admin'
                    ? 'Franchise Portal'
                    : userProfile?.email.toLowerCase() ===
                      BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
                    ? 'Super Admin Portal'
                    : 'Admin Portal'}
                </div>
                <div className="text-[11px] text-[#16A34A] font-semibold truncate">
                  {userProfile?.franchiseZone || 'Operations Hub'}
                </div>
              </div>
            )}
          </div>

          {/* Center Zone: Desktop Primary Navigation */}
          {workspaceMode === 'customer' && (
            <nav
              aria-label="Primary customer navigation"
              className="hidden md:flex items-center gap-1"
            >
              {(
                [
                  ['home', 'Home'],
                  ['categories', 'Categories'],
                  ['orders', 'Orders'],
                  ['cart', `Cart (${cartItemCount})`],
                  ['account', 'Account'],
                ] as const
              ).map(([tabKey, label]) => {
                const isActive = activeTab === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setActiveTab(tabKey);
                      if (tabKey === 'home') setServiceView('overview');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#16A34A]/10 text-[#16A34A]'
                        : 'text-neutral-600 hover:bg-[#F5F6F7] hover:text-[#222222]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right Zone: Notifications + Auth */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Notifications"
              className="relative w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-[#F5F6F7] flex items-center justify-center text-[#222222]"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#16A34A] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {userProfile ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (workspaceMode === 'customer') {
                      setActiveTab('account');
                    }
                  }}
                  className="h-9 px-3 rounded-lg bg-[#F5F6F7] border border-neutral-200 hover:border-neutral-300 flex items-center gap-2 text-xs font-semibold text-[#222222]"
                >
                  <span className="w-5 h-5 rounded-full bg-[#16A34A] text-white text-[10px] font-bold flex items-center justify-center">
                    {userProfile.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline max-w-[90px] truncate">
                    {userProfile.displayName.split(' ')[0]}
                  </span>
                </button>
                {workspaceMode !== 'customer' && (
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    aria-label="Sign out"
                    className="h-9 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-[#F5F6F7] text-xs font-semibold text-[#222222] flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={!authReady}
                onClick={() => setAuthModalOpen(true)}
                className="h-9 px-3.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold whitespace-nowrap transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-4 pt-5 ${
          workspaceMode === 'customer' ? 'pb-24 md:pb-10' : 'pb-10'
        }`}
      >
        {workspaceMode === 'customer' && renderCustomerContent()}

        {workspaceMode === 'partner' && (
          <PartnerPortalView
            user={userProfile}
            partnerProfile={partnerProfile}
            openJobs={openDispatchJobs}
            assignedOrders={partnerOrders}
            mapsApiKey={mapsApiKey}
            zones={effectiveZones}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        )}

        {workspaceMode === 'admin' && (
          <AdminPortalView
            user={userProfile}
            catalog={effectiveCatalog}
            orders={adminOrders}
            users={adminUsers}
            staffList={staffList}
            zones={effectiveZones}
            ads={effectiveAds}
            mapsApiKey={mapsApiKey}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Sticky Mini Cart Bar while browsing Food / Grocery / Shopping */}
      {workspaceMode === 'customer' &&
        activeTab !== 'cart' &&
        cartItemCount > 0 && (
          <div className="fixed bottom-18 md:bottom-5 right-4 left-4 md:left-auto md:w-96 z-30">
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              className="w-full px-4 py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white shadow-lg flex items-center justify-between transition-colors"
            >
              <div className="text-left tabular-nums">
                <div className="text-xs font-extrabold">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} · ₹
                  {cartSubtotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-white/85">
                  Extra charges may apply at checkout
                </div>
              </div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" />
                <span>View Cart</span>
              </div>
            </button>
          </div>
        )}

      {/* Mobile Native-Style Bottom Navigation Bar (Customer mode only) */}
      {workspaceMode === 'customer' && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 h-16 px-2 grid grid-cols-5 items-center"
        >
          {(
            [
              { key: 'home' as const, label: 'Home', icon: Home },
              { key: 'categories' as const, label: 'Categories', icon: LayoutGrid },
              { key: 'orders' as const, label: 'Orders', icon: PackageCheck },
              { key: 'cart' as const, label: 'Cart', icon: ShoppingBag },
              { key: 'account' as const, label: 'Account', icon: UserIcon },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key);
                  if (item.key === 'home') setServiceView('overview');
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 ${
                  active ? 'text-[#16A34A]' : 'text-neutral-500'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.8} />
                  {item.key === 'cart' && cartItemCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#16A34A] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Modals & Drawers */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        currentLocation={currentLocation}
        savedLocations={savedLocations}
        onSelectLocation={(loc) => setCurrentLocation(loc)}
        onAddLocation={handleAddLocation}
      />

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={(id) => void markNotificationRead(id)}
      />

      <ErrandPlannerDrawer
        open={errandPlannerOpen}
        onClose={() => setErrandPlannerOpen(false)}
        zone={currentLocation.zone}
      />
    </div>
  );

  return (
    <ErrorBoundary>
      {mapsApiKey ? (
        <APIProvider apiKey={mapsApiKey} language="en" region="IN">
          {appShell}
        </APIProvider>
      ) : (
        appShell
      )}
    </ErrorBoundary>
  );
}
