import React, { useMemo, useState } from 'react';
import { ArrowLeft, Clock, Minus, Plus, Search } from 'lucide-react';
import { CartItem, CatalogItem } from '../../types/unigo';
import { SafeImage } from '../SafeImage';

interface GroceryViewProps {
  catalog: CatalogItem[];
  cart: CartItem[];
  onAddToCart: (item: CatalogItem, qtyDelta: number) => void;
  onBackHome: () => void;
}

export const GroceryView: React.FC<GroceryViewProps> = ({
  catalog,
  cart,
  onAddToCart,
  onBackHome,
}) => {
  const groceries = useMemo(
    () => catalog.filter((i) => i.vertical === 'grocery'),
    [catalog]
  );
  const categories = useMemo(() => {
    const s = new Set<string>(['All']);
    groceries.forEach((g) => s.add(g.category));
    return Array.from(s);
  }, [groceries]);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return groceries.filter((g) => {
      if (selectedCategory !== 'All' && g.category !== selectedCategory) return false;
      if (query.trim() && !g.title.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [groceries, selectedCategory, query]);

  const getQty = (itemId: string) =>
    cart.find((c) => c.itemId === itemId)?.quantity ?? 0;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="w-9 h-9 rounded-lg border border-neutral-200 bg-white flex items-center justify-center hover:bg-[#F5F6F7]"
          >
            <ArrowLeft className="w-4 h-4 text-[#222222]" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-[#222222]">
              UniGo Grocery Mart
            </h1>
            <p className="text-xs text-[#16A34A] font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Delivery in 12 mins from nearby dark store</span>
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search milk, fruit, oil..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F5F6F7] border border-neutral-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#16A34A]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Category Rail */}
        <aside className="md:col-span-3 flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left whitespace-nowrap transition-colors border ${
                selectedCategory === cat
                  ? 'bg-[#16A34A] text-white border-[#16A34A]'
                  : 'bg-[#F5F6F7] text-[#222222] border-neutral-200 hover:bg-neutral-200/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </aside>

        {/* Product Grid */}
        <div className="md:col-span-9 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {filtered.map((item) => {
            const qty = getQty(item.id);
            return (
              <div
                key={item.id}
                className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#F5F6F7] mb-2.5">
                    <SafeImage src={item.imageUrl} alt={item.title} vertical="grocery" />
                  </div>
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    {item.etaMinutes ?? 12} mins · {item.unitLabel}
                  </div>
                  <h3 className="text-sm font-bold text-[#222222] mt-0.5 line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                    {item.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-100">
                  <div className="tabular-nums">
                    <div className="text-sm font-extrabold text-[#222222]">
                      ₹{item.price}
                    </div>
                    {item.originalPrice && (
                      <div className="text-[11px] text-neutral-400 line-through">
                        ₹{item.originalPrice}
                      </div>
                    )}
                  </div>
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => onAddToCart(item, 1)}
                      className="px-3.5 py-1.5 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A] hover:text-white text-xs font-bold transition-colors"
                    >
                      ADD
                    </button>
                  ) : (
                    <div className="flex items-center bg-[#16A34A] text-white rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onAddToCart(item, -1)}
                        className="px-2.5 py-1.5 hover:bg-[#15803D]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-bold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAddToCart(item, 1)}
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
    </div>
  );
};
