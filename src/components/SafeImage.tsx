import React, { useState } from 'react';
import {
  Bike,
  Car,
  Home,
  Package,
  ShoppingBag,
  ShoppingBasket,
  Utensils,
  Wrench,
} from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  vertical?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  vertical = 'shopping',
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const Icon =
      vertical === 'food' || vertical === 'restaurant' || vertical === 'dish'
        ? Utensils
        : vertical === 'grocery'
        ? ShoppingBasket
        : vertical === 'ride'
        ? Car
        : vertical === 'service'
        ? Wrench
        : vertical === 'rental'
        ? Home
        : vertical === 'parcel'
        ? Package
        : vertical === 'bike'
        ? Bike
        : ShoppingBag;

    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F5F6F7] to-neutral-200/80 text-neutral-500 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Icon className="w-7 h-7 text-[#16A34A]/70 mb-1.5" strokeWidth={1.75} />
        <span className="text-[11px] font-medium text-neutral-600 px-3 text-center line-clamp-2">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};
