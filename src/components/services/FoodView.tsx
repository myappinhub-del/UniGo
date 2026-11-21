import React, { useMemo, useState } from 'react';
import { ArrowLeft, Minus, Plus, SlidersHorizontal, Star, X } from 'lucide-react';
import { CartItem, CatalogItem } from '../../types/unigo';
import { SafeImage } from '../SafeImage';

interface FoodViewProps {
  catalog: CatalogItem[];
  cart: CartItem[];
  initialRestaurantId?: string;
  onAddToCart: (item: CatalogItem, qtyDelta: number, customization?: string, parentName?: string) => void;
  onBackHome: () => void;
}

export const FoodView: React.FC<FoodViewProps> = ({
  catalog,
  cart,
  initialRestaurantId,
  onAddToCart,
  onBackHome,
}) => {
  const restaurants = useMemo(
    () => catalog.filter((i) => i.vertical === 'restaurant'),
    [catalog]
  );
  const dishes = useMemo(
    () => catalog.filter((i) => i.vertical === 'dish'),
    [catalog]
  );

  const [selectedRestId, setSelectedRestId] = useState<string | null>(
    initialRestaurantId && restaurants.some((r) => r.id === initialRestaurantId)
      ? initialRestaurantId
      : null
  );
  const [vegOnly, setVegOnly] = useState(false);
  const [cuisineFilter, setCuisineFilter] = useState('All');
  const [customizingDish, setCustomizingDish] = useState<CatalogItem | null>(null);
  const [portion, setPortion] = useState<'Regular' | 'Large (+₹60)'>('Regular');
  const [spice, setSpice] = useState<'Mild' | 'Medium' | 'Spicy'>('Medium');
  const [addonRaita, setAddonRaita] = useState(false);

  const cuisines = useMemo(() => {
    const set = new Set<string>(['All']);
    restaurants.forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      if (vegOnly && !r.isVeg) return false;
      if (cuisineFilter !== 'All' && r.category !== cuisineFilter) return false;
      return true;
    });
  }, [restaurants, vegOnly, cuisineFilter]);

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestId) || null;
  const restaurantDishes = useMemo(() => {
    const base = selectedRestId
      ? dishes.filter((d) => d.parentId === selectedRestId)
      : dishes;
    return vegOnly ? base.filter((d) => d.isVeg) : base;
  }, [dishes, selectedRestId, vegOnly]);

  const getQty = (itemId: string) =>
    cart.find((c) => c.itemId === itemId)?.quantity ?? 0;

  const confirmCustomization = () => {
    if (!customizingDish) return;
    const extra = (portion.includes('Large') ? 60 : 0) + (addonRaita ? 35 : 0);
    const modifiedItem: CatalogItem = {
      ...customizingDish,
      price: customizingDish.price + extra,
    };
    const summary = [
      portion.split(' ')[0],
      `${spice} spice`,
      addonRaita ? 'Extra Raita/Dip' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const parentName = restaurants.find((r) => r.id === customizingDish.parentId)?.title;
    onAddToCart(modifiedItem, 1, summary, parentName);
    setCustomizingDish(null);
    setPortion('Regular');
    setSpice('Medium');
    setAddonRaita(false);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (selectedRestId ? setSelectedRestId(null) : onBackHome())}
            className="w-9 h-9 rounded-lg border border-neutral-200 bg-white flex items-center justify-center hover:bg-[#F5F6F7]"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-[#222222]" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-[#222222]">
              {selectedRestaurant ? selectedRestaurant.title : 'Food Delivery'}
            </h1>
            <p className="text-xs text-neutral-500">
              {selectedRestaurant
                ? `${selectedRestaurant.subtitle} · ${selectedRestaurant.etaMinutes} mins`
                : 'Discover restaurants, customize meals, and track hot delivery'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVegOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              vegOnly
                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                : 'bg-white text-[#222222] border-neutral-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Pure Veg</span>
          </button>
        </div>
      </div>

      {!selectedRestaurant && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {cuisines.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCuisineFilter(c)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                  cuisineFilter === c
                    ? 'bg-[#222222] text-white border-[#222222]'
                    : 'bg-[#F5F6F7] text-[#222222] border-neutral-200 hover:bg-neutral-200/70'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredRestaurants.map((rest) => (
              <button
                key={rest.id}
                type="button"
                onClick={() => setSelectedRestId(rest.id)}
                className="text-left bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-[#16A34A] transition-colors flex flex-col"
              >
                <div className="aspect-[4/3] bg-[#F5F6F7] relative overflow-hidden">
                  <SafeImage src={rest.imageUrl} alt={rest.title} vertical="restaurant" />
                </div>
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#222222] truncate">
                      {rest.title}
                    </h3>
                    <span className="text-xs font-bold text-[#16A34A] flex items-center gap-0.5 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-[#16A34A]" />
                      {rest.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                    {rest.subtitle}
                  </p>
                  <div className="text-[11px] font-medium text-neutral-500 mt-2">
                    {rest.etaMinutes} mins · {rest.unitLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Menu Section */}
      <div>
        <h2 className="text-base font-bold text-[#222222] mb-3">
          {selectedRestaurant ? 'Full Menu' : 'Popular Dishes Across Kitchens'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {restaurantDishes.map((dish) => {
            const qty = getQty(dish.id);
            const parentName = restaurants.find((r) => r.id === dish.parentId)?.title;
            return (
              <div
                key={dish.id}
                className="bg-white border border-neutral-200 rounded-xl p-4 flex justify-between gap-4"
              >
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500">
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
                      <span>{parentName || dish.category}</span>
                      <span>·</span>
                      <span className="text-[#16A34A] font-semibold tabular-nums">
                        {dish.rating.toFixed(1)} ★
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#222222] mt-1">
                      {dish.title}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                      {dish.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-sm font-extrabold text-[#222222] tabular-nums">
                      ₹{dish.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomizingDish(dish)}
                      className="text-xs font-semibold text-[#16A34A] hover:underline"
                    >
                      Customize
                    </button>
                  </div>
                </div>

                <div className="w-28 shrink-0 flex flex-col items-center gap-2">
                  <div className="w-28 h-24 rounded-lg overflow-hidden bg-[#F5F6F7]">
                    <SafeImage src={dish.imageUrl} alt={dish.title} vertical="dish" />
                  </div>
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => onAddToCart(dish, 1, undefined, parentName)}
                      className="w-full py-1.5 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-bold transition-colors"
                    >
                      ADD
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-[#16A34A] text-white rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onAddToCart(dish, -1)}
                        className="px-2.5 py-1.5 hover:bg-[#15803D]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        onClick={() => onAddToCart(dish, 1)}
                        className="px-2.5 py-1.5 hover:bg-[#15803D]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dish Customization Modal */}
      {customizingDish && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-neutral-200 shadow-xl">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-[#222222]">
                  Customize {customizingDish.title}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                  Base price ₹{customizingDish.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingDish(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              <div>
                <div className="text-xs font-bold text-[#222222] mb-2">Portion Size</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['Regular', 'Large (+₹60)'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPortion(p)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                        portion === p
                          ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                          : 'border-neutral-200 text-[#222222]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-[#222222] mb-2">Spice Level</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['Mild', 'Medium', 'Spicy'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpice(s)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                        spice === s
                          ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A]'
                          : 'border-neutral-200 text-[#222222]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#222222]">
                    Add Mint Raita / Extra Dip
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums">+₹35</div>
                </div>
                <input
                  type="checkbox"
                  checked={addonRaita}
                  onChange={(e) => setAddonRaita(e.target.checked)}
                  className="w-4 h-4 accent-[#16A34A]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={confirmCustomization}
              className="w-full py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold tabular-nums transition-colors"
            >
              Add Item · ₹
              {customizingDish.price +
                (portion.includes('Large') ? 60 : 0) +
                (addonRaita ? 35 : 0)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
