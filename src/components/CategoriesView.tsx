import React from 'react';
import {
  Bike,
  Car,
  ChevronRight,
  Home,
  Package,
  ShoppingBag,
  ShoppingBasket,
  Truck,
  Utensils,
  Wrench,
} from 'lucide-react';
import { CatalogItem, ServiceViewKey } from '../types/unigo';

interface CategoriesViewProps {
  catalog: CatalogItem[];
  onSelectService: (view: ServiceViewKey) => void;
  onSelectRideTier: (tier: 'bike' | 'auto' | 'car') => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  catalog,
  onSelectService,
  onSelectRideTier,
}) => {
  const countBy = (v: string) => catalog.filter((i) => i.vertical === v).length;

  const cards = [
    {
      title: 'Food Delivery',
      sub: `${countBy('restaurant')} restaurants · ${countBy('dish')} dishes`,
      icon: Utensils,
      action: () => onSelectService('food'),
    },
    {
      title: 'Grocery Mart',
      sub: `${countBy('grocery')} daily essentials · 12-min delivery`,
      icon: ShoppingBasket,
      action: () => onSelectService('grocery'),
    },
    {
      title: 'Shopping Store',
      sub: `${countBy('shopping')} electronics & home products`,
      icon: ShoppingBag,
      action: () => onSelectService('shopping'),
    },
    {
      title: 'Bike Rides',
      sub: 'Beat traffic · Instant captain pickup',
      icon: Bike,
      action: () => {
        onSelectRideTier('bike');
        onSelectService('rides');
      },
    },
    {
      title: 'Auto Rides',
      sub: 'Doorstep metered auto rides',
      icon: Truck,
      action: () => {
        onSelectRideTier('auto');
        onSelectService('rides');
      },
    },
    {
      title: 'Car Rides',
      sub: 'AC Prime Sedans for city & airport',
      icon: Car,
      action: () => {
        onSelectRideTier('car');
        onSelectService('rides');
      },
    },
    {
      title: 'Home Services',
      sub: `${countBy('service')} verified cleaning & repair services`,
      icon: Wrench,
      action: () => onSelectService('services'),
    },
    {
      title: 'Rentals',
      sub: `${countBy('rental')} furnished homes & EV vehicles`,
      icon: Home,
      action: () => onSelectService('rentals'),
    },
    {
      title: 'Parcel Delivery',
      sub: 'Same-hour intra-city courier pickup',
      icon: Package,
      action: () => onSelectService('parcel'),
    },
  ];

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-extrabold text-[#222222]">All Categories</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Everything. Everywhere. One App. Choose any UniGo service below.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.title}
              type="button"
              onClick={c.action}
              className="p-4 rounded-xl bg-white border border-neutral-200 hover:border-[#16A34A] text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#F5F6F7] border border-neutral-200 flex items-center justify-center text-[#16A34A] shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#222222]">{c.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5 truncate">{c.sub}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
