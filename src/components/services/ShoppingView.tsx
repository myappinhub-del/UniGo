import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Heart, ShieldCheck, Star, X } from 'lucide-react';
import { CartItem, CatalogItem } from '../../types/unigo';
import { SafeImage } from '../SafeImage';

interface ShoppingViewProps {
  catalog: CatalogItem[];
  cart: CartItem[];
  wishlistIds: string[];
  initialProductId?: string;
  onAddToCart: (item: CatalogItem, qtyDelta: number) => void;
  onToggleWishlist: (itemId: string) => void;
  onBackHome: () => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  catalog,
  wishlistIds,
  initialProductId,
  onAddToCart,
  onToggleWishlist,
  onBackHome,
}) => {
  const products = useMemo(
    () => catalog.filter((i) => i.vertical === 'shopping'),
    [catalog]
  );

  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(
    () => products.find((p) => p.id === initialProductId) || null
  );

  const categories = useMemo(() => {
    const s = new Set<string>(['All']);
    products.forEach((p) => s.add(p.category));
    return Array.from(s);
  }, [products]);

  const filtered = useMemo(() => {
    if (category === 'All') return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  return (
    <div className="space-y-6 pb-8">
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
              UniGo Shopping Store
            </h1>
            <p className="text-xs text-neutral-500">
              Electronics, home essentials & same-day express dispatch
            </p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                category === cat
                  ? 'bg-[#222222] text-white border-[#222222]'
                  : 'bg-[#F5F6F7] text-[#222222] border-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((prod) => {
          const wished = wishlistIds.includes(prod.id);
          const discountPct = prod.originalPrice
            ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)
            : 0;

          return (
            <div
              key={prod.id}
              className="bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(prod)}
                  className="block w-full aspect-[4/3] bg-[#F5F6F7] overflow-hidden"
                >
                  <SafeImage src={prod.imageUrl} alt={prod.title} vertical="shopping" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleWishlist(prod.id)}
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-red-500"
                  aria-label="Wishlist"
                >
                  <Heart className={`w-4 h-4 ${wished ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>{prod.category}</span>
                    <span className="flex items-center gap-0.5 text-[#16A34A] font-semibold tabular-nums">
                      <Star className="w-3 h-3 fill-[#16A34A]" />
                      {prod.rating.toFixed(1)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(prod)}
                    className="text-sm font-bold text-[#222222] mt-1 text-left hover:text-[#16A34A] line-clamp-2"
                  >
                    {prod.title}
                  </button>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                    {prod.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 space-y-2.5">
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-base font-extrabold text-[#222222]">
                      ₹{prod.price.toLocaleString('en-IN')}
                    </span>
                    {prod.originalPrice && (
                      <span className="text-xs text-neutral-400 line-through">
                        ₹{prod.originalPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                    {discountPct > 0 && (
                      <span className="text-xs font-bold text-[#16A34A]">
                        {discountPct}% off
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(prod)}
                      className="py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-[#222222] hover:bg-[#F5F6F7]"
                    >
                      Specs
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddToCart(prod, 1)}
                      className="py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold transition-colors"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden border border-neutral-200 shadow-xl grid grid-cols-1 md:grid-cols-12">
            <div className="md:col-span-5 bg-[#F5F6F7] min-h-[240px]">
              <SafeImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.title}
                vertical="shopping"
              />
            </div>
            <div className="md:col-span-7 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold text-[#16A34A]">
                    {selectedProduct.category} · {selectedProduct.unitLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-lg font-extrabold text-[#222222] mt-1">
                  {selectedProduct.title}
                </h2>
                <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
                  {selectedProduct.subtitle}
                </p>

                <div className="flex items-baseline gap-2 mt-3 tabular-nums">
                  <span className="text-2xl font-extrabold text-[#222222]">
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </span>
                  {selectedProduct.originalPrice && (
                    <span className="text-xs text-neutral-400 line-through">
                      ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                {selectedProduct.specs && selectedProduct.specs.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-100 space-y-1.5">
                    <div className="text-xs font-bold text-[#222222]">
                      Key Specifications
                    </div>
                    {selectedProduct.specs.map((spec, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-neutral-600 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] mt-0.5 shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onToggleWishlist(selectedProduct.id)}
                  className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-[#222222] flex items-center gap-1.5"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      wishlistIds.includes(selectedProduct.id)
                        ? 'fill-red-500 text-red-500'
                        : ''
                    }`}
                  />
                  <span>Wishlist</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(selectedProduct, 1);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Add to Cart · Same-Day Delivery</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
