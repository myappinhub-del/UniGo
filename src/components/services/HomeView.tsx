import React, { useMemo, useState } from 'react';
import {
  Bike,
  Car,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe,
  Heart,
  Home,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Star,
  Truck,
  Utensils,
  Wrench,
} from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import {
  AdBanner,
  AddressEntry,
  CartItem,
  CatalogItem,
  ServiceViewKey,
} from '../../types/unigo';
import { IMG_HERO_GROCERY, SEED_ADS } from '../../data/seedCatalog';
import { SafeImage } from '../SafeImage';

interface HomeViewProps {
  catalog: CatalogItem[];
  ads?: AdBanner[];
  cart: CartItem[];
  wishlistIds: string[];
  currentLocation: AddressEntry;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigateService: (view: ServiceViewKey, preselectId?: string) => void;
  onAddToCart: (item: CatalogItem, qtyDelta: number) => void;
  onToggleWishlist: (itemId: string) => void;
  onOpenErrandPlanner: () => void;
  onSelectRideTier: (tier: 'bike' | 'auto' | 'car') => void;
}

interface SearchGroundResult {
  text: string;
  sources: { uri: string; title: string }[];
}

interface MapsGroundResult {
  text: string;
  places: { uri: string; title: string; reviewSnippets?: string[] }[];
}

export const HomeView: React.FC<HomeViewProps> = ({
  catalog,
  ads = [],
  cart,
  wishlistIds,
  currentLocation,
  searchQuery,
  onSearchChange,
  onNavigateService,
  onAddToCart,
  onToggleWishlist,
  onOpenErrandPlanner,
  onSelectRideTier,
}) => {
  const [webLoading, setWebLoading] = useState(false);
  const [webResult, setWebResult] = useState<SearchGroundResult | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<MapsGroundResult | null>(null);
  const [groundError, setGroundError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [adIndex, setAdIndex] = useState(0);

  const activeAds = useMemo(() => {
    const source = ads.length > 0 ? ads : SEED_ADS;
    const zoneFirst = currentLocation.zone.split(',')[0].trim().toLowerCase();
    const matching = source.filter(
      (a) =>
        a.isActive &&
        (a.franchiseZone === 'All Zones' ||
          a.franchiseZone.toLowerCase().includes(zoneFirst) ||
          currentLocation.zone.toLowerCase().includes(a.franchiseZone.toLowerCase()))
    );
    return matching.sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
  }, [ads, currentLocation.zone]);

  const currentHeroAd = activeAds[adIndex % Math.max(1, activeAds.length)] || null;

  const promoOffers = useMemo(() => {
    const fromAds = activeAds
      .filter((a) => a.promoCode && a.promoCode.trim().length > 0)
      .map((a) => ({
        code: a.promoCode!.trim().toUpperCase(),
        desc: a.title,
      }));
    if (fromAds.length > 0) return fromAds.slice(0, 4);
    return [
      { code: 'UNIGO50', desc: 'Flat ₹50 off on orders above ₹249' },
      { code: 'FRESH20', desc: '20% off (up to ₹80) on fresh groceries' },
    ];
  }, [activeAds]);

  const restaurants = useMemo(
    () => catalog.filter((i) => i.vertical === 'restaurant'),
    [catalog]
  );
  const dishes = useMemo(
    () => catalog.filter((i) => i.vertical === 'dish').slice(0, 4),
    [catalog]
  );
  const groceries = useMemo(
    () => catalog.filter((i) => i.vertical === 'grocery').slice(0, 6),
    [catalog]
  );
  const products = useMemo(
    () => catalog.filter((i) => i.vertical === 'shopping').slice(0, 4),
    [catalog]
  );
  const services = useMemo(
    () => catalog.filter((i) => i.vertical === 'service').slice(0, 3),
    [catalog]
  );

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.subtitle || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [catalog, searchQuery]);

  const getQty = (itemId: string) =>
    cart.find((c) => c.itemId === itemId)?.quantity ?? 0;

  const handleLiveWebLookup = async () => {
    const q = searchQuery.trim() || 'top rated restaurants and grocery deals';
    setWebLoading(true);
    setGroundError(null);
    try {
      const res = await fetch('/api/ai/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, city: currentLocation.zone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search lookup failed');
      setWebResult(data);
    } catch (err: any) {
      setGroundError(err.message);
    } finally {
      setWebLoading(false);
    }
  };

  const handleNearbyMapsLookup = async () => {
    const q = searchQuery.trim() || 'popular restaurants, supermarkets and repair shops';
    setMapsLoading(true);
    setGroundError(null);
    try {
      const res = await fetch('/api/ai/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maps lookup failed');
      setMapsResult(data);
    } catch (err: any) {
      setGroundError(err.message);
    } finally {
      setMapsLoading(false);
    }
  };

  const serviceCategories = [
    {
      key: 'food',
      label: 'Food Delivery',
      icon: Utensils,
      action: () => onNavigateService('food'),
    },
    {
      key: 'grocery',
      label: 'Grocery',
      icon: ShoppingBasket,
      action: () => onNavigateService('grocery'),
    },
    {
      key: 'shopping',
      label: 'Shopping',
      icon: ShoppingBag,
      action: () => onNavigateService('shopping'),
    },
    {
      key: 'bike',
      label: 'Bike Rides',
      icon: Bike,
      action: () => {
        onSelectRideTier('bike');
        onNavigateService('rides');
      },
    },
    {
      key: 'auto',
      label: 'Auto Rides',
      icon: Truck,
      action: () => {
        onSelectRideTier('auto');
        onNavigateService('rides');
      },
    },
    {
      key: 'car',
      label: 'Car Rides',
      icon: Car,
      action: () => {
        onSelectRideTier('car');
        onNavigateService('rides');
      },
    },
    {
      key: 'services',
      label: 'Home Services',
      icon: Wrench,
      action: () => onNavigateService('services'),
    },
    {
      key: 'rentals',
      label: 'Rentals',
      icon: Home,
      action: () => onNavigateService('rentals'),
    },
    {
      key: 'parcel',
      label: 'Parcel Delivery',
      icon: Package,
      action: () => onNavigateService('parcel'),
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Search Bar & Grounded Lookup Bar */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search for food, groceries, shops and services"
              className="w-full pl-10 pr-4 py-3 text-sm bg-[#F5F6F7] border border-neutral-200 rounded-xl text-[#222222] placeholder:text-neutral-500 focus:outline-none focus:bg-white focus:border-[#16A34A] transition-colors"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleNearbyMapsLookup}
              disabled={mapsLoading}
              className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white hover:bg-[#F5F6F7] text-xs font-semibold text-[#222222] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Compass className="w-4 h-4 text-[#16A34A]" />
              <span>{mapsLoading ? 'Checking...' : 'Explore Nearby'}</span>
            </button>
            <button
              type="button"
              onClick={handleLiveWebLookup}
              disabled={webLoading}
              className="px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white hover:bg-[#F5F6F7] text-xs font-semibold text-[#222222] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Globe className="w-4 h-4 text-[#16A34A]" />
              <span>{webLoading ? 'Searching...' : 'Live Web Info'}</span>
            </button>
          </div>
        </div>

        {/* Live Search Matches */}
        {searchQuery.trim().length > 0 && (
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500">
                Catalog matches for "{searchQuery}"
              </span>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-xs font-semibold text-[#16A34A] hover:underline"
              >
                Clear
              </button>
            </div>
            {filteredMatches.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No direct catalog match. Try "Explore Nearby" or "Live Web Info" above for real-time local results.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredMatches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const target: ServiceViewKey =
                        item.vertical === 'restaurant' || item.vertical === 'dish'
                          ? 'food'
                          : item.vertical === 'grocery'
                          ? 'grocery'
                          : item.vertical === 'shopping'
                          ? 'shopping'
                          : item.vertical === 'service'
                          ? 'services'
                          : 'rentals';
                      onNavigateService(target, item.id);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-neutral-200 hover:border-[#16A34A] text-left transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                      <SafeImage src={item.imageUrl} alt={item.title} vertical={item.vertical} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#222222] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {item.category} · ₹{item.price.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {groundError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {groundError}
          </div>
        )}

        {webResult && (
          <div className="bg-[#F5F6F7] border border-neutral-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Live Local Web Information</span>
              </div>
              <button
                type="button"
                onClick={() => setWebResult(null)}
                className="text-xs text-neutral-500 hover:text-[#222222]"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
              {webResult.text}
            </p>
            {webResult.sources.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {webResult.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-[#16A34A] hover:underline flex items-center gap-1"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {mapsResult && (
          <div className="bg-[#F5F6F7] border border-neutral-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Verified Nearby Places ({currentLocation.zone})</span>
              </div>
              <button
                type="button"
                onClick={() => setMapsResult(null)}
                className="text-xs text-neutral-500 hover:text-[#222222]"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
              {mapsResult.text}
            </p>
            {mapsResult.places.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {mapsResult.places.map((pl, i) => (
                  <a
                    key={i}
                    href={pl.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-white rounded-lg border border-neutral-200 hover:border-[#16A34A] flex items-center justify-between gap-2 text-xs font-medium text-[#222222]"
                  >
                    <span className="truncate">{pl.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Promotional Campaign Banner (Live Super Admin Ads) */}
      {currentHeroAd && (
        <section className="rounded-2xl overflow-hidden border border-neutral-200 bg-white grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center bg-[#F5F6F7]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs font-semibold text-[#16A34A] tracking-wide">
                {currentHeroAd.badgeText || 'UniGo Express'} · {currentLocation.zone}
              </div>
              {activeAds.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setAdIndex(
                        (prev) => (prev - 1 + activeAds.length) % activeAds.length
                      )
                    }
                    aria-label="Previous promotion"
                    className="w-7 h-7 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#222222] hover:border-[#16A34A]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-semibold text-neutral-500 px-1 tabular-nums">
                    {(adIndex % activeAds.length) + 1}/{activeAds.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdIndex((prev) => (prev + 1) % activeAds.length)
                    }
                    aria-label="Next promotion"
                    className="w-7 h-7 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#222222] hover:border-[#16A34A]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#222222] leading-tight text-balance">
              {currentHeroAd.title}
            </h1>
            <p className="text-sm text-neutral-600 mt-2.5 max-w-lg leading-relaxed">
              {currentHeroAd.subtitle}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateService(currentHeroAd.targetVertical)}
                className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {currentHeroAd.ctaLabel}
              </button>
              <button
                type="button"
                onClick={() => onNavigateService('food')}
                className="px-5 py-2.5 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 text-[#222222] text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Explore Restaurants
              </button>
              {currentHeroAd.promoCode && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(currentHeroAd.promoCode!).catch(() => {});
                    setCopiedCode(currentHeroAd.promoCode!);
                    setTimeout(() => setCopiedCode(null), 2000);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-[#16A34A]/40 text-xs font-bold text-[#16A34A] whitespace-nowrap"
                >
                  {copiedCode === currentHeroAd.promoCode
                    ? `Copied ${currentHeroAd.promoCode}`
                    : `Code: ${currentHeroAd.promoCode}`}
                </button>
              )}
            </div>
          </div>
          <div className="md:col-span-5 h-48 md:h-auto min-h-[210px] relative">
            <SafeImage
              src={currentHeroAd.imageUrl || IMG_HERO_GROCERY}
              alt={currentHeroAd.title}
              vertical={currentHeroAd.targetVertical === 'food' ? 'restaurant' : 'grocery'}
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      {/* Horizontal 9 Service Categories */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base md:text-lg font-bold text-[#222222]">
            What do you need today?
          </h2>
          <button
            type="button"
            onClick={onOpenErrandPlanner}
            className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>Plan multi-stop errand</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {serviceCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={cat.action}
                className="min-w-[92px] sm:min-w-[106px] flex flex-col items-center p-3 rounded-xl bg-[#F5F6F7] hover:bg-neutral-200/70 border border-transparent hover:border-neutral-200 transition-colors shrink-0"
              >
                <div className="w-11 h-11 rounded-xl bg-white border border-neutral-200/80 flex items-center justify-center text-[#16A34A] mb-2">
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <span className="text-xs font-semibold text-[#222222] text-center whitespace-nowrap">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Popular Restaurants */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#222222]">
              Popular Restaurants Near You
            </h2>
            <p className="text-xs text-neutral-500">
              Top-rated kitchens delivering to {currentLocation.zone}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateService('food')}
            className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-0.5 whitespace-nowrap shrink-0"
          >
            <span>See all</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {restaurants.map((rest) => (
            <button
              key={rest.id}
              type="button"
              onClick={() => onNavigateService('food', rest.id)}
              className="group text-left bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-300 hover:shadow-sm transition-all flex flex-col"
            >
              <div className="aspect-[4/3] w-full overflow-hidden relative bg-[#F5F6F7]">
                <SafeImage
                  src={rest.imageUrl}
                  alt={rest.title}
                  vertical="restaurant"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/65 to-transparent" />
                <div className="absolute bottom-2.5 left-3 text-white text-xs font-semibold tabular-nums">
                  {rest.etaMinutes ?? 25} mins
                </div>
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#222222] truncate">
                      {rest.title}
                    </h3>
                    <span className="flex items-center gap-1 text-xs font-bold text-[#16A34A] tabular-nums shrink-0">
                      <Star className="w-3.5 h-3.5 fill-[#16A34A]" />
                      {rest.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                    {rest.subtitle}
                  </p>
                </div>
                <div className="text-[11px] text-neutral-500 mt-2.5 pt-2 border-t border-neutral-100">
                  {rest.category} · {rest.unitLabel || currentLocation.zone}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recommended Food */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base md:text-lg font-bold text-[#222222]">
            Recommended Dishes
          </h2>
          <button
            type="button"
            onClick={() => onNavigateService('food')}
            className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-0.5 whitespace-nowrap shrink-0"
          >
            <span>Full menu</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dishes.map((dish) => {
            const qty = getQty(dish.id);
            return (
              <div
                key={dish.id}
                className="bg-white border border-neutral-200 rounded-xl p-3 flex gap-3 items-center"
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-[#F5F6F7]">
                  <SafeImage src={dish.imageUrl} alt={dish.title} vertical="dish" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <span
                      className={`w-2.5 h-2.5 border inline-flex items-center justify-center rounded-[2px] ${
                        dish.isVeg ? 'border-[#16A34A]' : 'border-red-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          dish.isVeg ? 'bg-[#16A34A]' : 'bg-red-600'
                        }`}
                      />
                    </span>
                    <span>{dish.category}</span>
                  </div>
                  <div className="text-xs font-bold text-[#222222] mt-0.5 line-clamp-1">
                    {dish.title}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-[#222222] tabular-nums">
                      ₹{dish.price}
                    </span>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddToCart(dish, 1)}
                        className="px-3 py-1 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-bold transition-colors"
                      >
                        ADD
                      </button>
                    ) : (
                      <div className="flex items-center bg-[#16A34A] text-white rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => onAddToCart(dish, -1)}
                          className="px-2 py-1 hover:bg-[#15803D]"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddToCart(dish, 1)}
                          className="px-2 py-1 hover:bg-[#15803D]"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 10-Min Grocery Essentials */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-base md:text-lg font-bold text-[#222222]">
              Grocery Essentials in 12 Mins
            </h2>
            <p className="text-xs text-neutral-500">
              Fresh produce, bakery & pantry staples from nearby UniGo dark stores
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateService('grocery')}
            className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-0.5 whitespace-nowrap shrink-0"
          >
            <span>Browse aisle</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {groceries.map((item) => {
            const qty = getQty(item.id);
            return (
              <div
                key={item.id}
                className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#F5F6F7] mb-2.5">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.title}
                      vertical="grocery"
                    />
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    12 mins · {item.unitLabel}
                  </div>
                  <h3 className="text-xs font-bold text-[#222222] mt-0.5 line-clamp-2 min-h-[32px]">
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100">
                  <div>
                    <div className="text-sm font-bold text-[#222222] tabular-nums">
                      ₹{item.price}
                    </div>
                    {item.originalPrice && (
                      <div className="text-[11px] text-neutral-400 line-through tabular-nums">
                        ₹{item.originalPrice}
                      </div>
                    )}
                  </div>
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => onAddToCart(item, 1)}
                      className="px-3 py-1.5 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-bold transition-colors"
                    >
                      ADD
                    </button>
                  ) : (
                    <div className="flex items-center bg-[#16A34A] text-white rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onAddToCart(item, -1)}
                        className="px-2 py-1.5 hover:bg-[#15803D]"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAddToCart(item, 1)}
                        className="px-2 py-1.5 hover:bg-[#15803D]"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Popular Shopping Products */}
      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-base md:text-lg font-bold text-[#222222]">
            Popular Shopping Deals
          </h2>
          <button
            type="button"
            onClick={() => onNavigateService('shopping')}
            className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-0.5 whitespace-nowrap shrink-0"
          >
            <span>All products</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((prod) => {
            const wished = wishlistIds.includes(prod.id);
            return (
              <div
                key={prod.id}
                className="bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => onNavigateService('shopping', prod.id)}
                    className="block w-full aspect-[4/3] bg-[#F5F6F7] overflow-hidden"
                  >
                    <SafeImage
                      src={prod.imageUrl}
                      alt={prod.title}
                      vertical="shopping"
                      className="w-full h-full object-cover hover:scale-[1.02] transition-transform"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(prod.id)}
                    aria-label="Toggle wishlist"
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-red-500"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        wished ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-neutral-500">
                      {prod.category} · {prod.rating.toFixed(1)} ★
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateService('shopping', prod.id)}
                      className="text-sm font-bold text-[#222222] mt-0.5 text-left hover:text-[#16A34A] line-clamp-1"
                    >
                      {prod.title}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-baseline gap-1.5 tabular-nums">
                      <span className="text-base font-extrabold text-[#222222]">
                        ₹{prod.price.toLocaleString('en-IN')}
                      </span>
                      {prod.originalPrice && (
                        <span className="text-xs text-neutral-400 line-through">
                          ₹{prod.originalPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddToCart(prod, 1)}
                      className="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#16A34A] text-white text-xs font-semibold transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Nearby Home Services & Special Offers */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#222222]">
                Nearby Verified Home Services
              </h2>
              <p className="text-xs text-neutral-500">
                Upfront rate cards with 30-day service warranty
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateService('services')}
              className="text-xs font-semibold text-[#16A34A] hover:underline"
            >
              Book slot
            </button>
          </div>
          <div className="divide-y divide-neutral-100">
            {services.map((srv) => (
              <div
                key={srv.id}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#222222]">
                    {srv.title}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {srv.unitLabel} · {srv.rating.toFixed(1)} ★
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-[#222222] tabular-nums">
                    ₹{srv.price}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateService('services', srv.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F6F7] hover:bg-[#16A34A] hover:text-white text-xs font-semibold text-[#222222] transition-colors"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#F5F6F7] border border-neutral-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#222222]">
              Special Offers & Promo Codes
            </h2>
            <p className="text-xs text-neutral-600 mt-1">
              Apply these active codes directly inside your UniGo Cart.
            </p>
            <div className="space-y-2.5 mt-4">
              {promoOffers.map((offer) => (
                <div
                  key={offer.code}
                  className="bg-white border border-neutral-200 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-extrabold text-[#16A34A] tracking-wide">
                      {offer.code}
                    </div>
                    <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                      {offer.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(offer.code).catch(() => {});
                      setCopiedCode(offer.code);
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-[#F5F6F7] hover:bg-neutral-200 text-xs font-semibold text-[#222222] shrink-0"
                  >
                    {copiedCode === offer.code ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateService('parcel')}
            className="mt-4 w-full py-2.5 rounded-xl bg-[#222222] hover:bg-[#16A34A] text-white text-xs font-semibold transition-colors"
          >
            Send Instant City Parcel
          </button>
        </div>
      </section>
    </div>
  );
};
