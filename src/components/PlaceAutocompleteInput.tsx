import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Search } from 'lucide-react';
import { LatLngLiteral } from '../types/unigo';

interface PlacePredictionLike {
  text: { text: string };
  toPlace: () => {
    fetchFields: (opts: { fields: string[] }) => Promise<void>;
    location?: { lat: () => number; lng: () => number } | null;
    formattedAddress?: string;
  };
}

interface AutocompleteSuggestionLike {
  placePrediction?: PlacePredictionLike | null;
}

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

interface PlaceAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder: string;
  presets?: { label: string; address: string; lat: number; lng: number }[];
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  presets = [],
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<unknown>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestionLike[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!placesLib || !focused || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib as any;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let active = true;
    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['in'],
      })
        .then((res: { suggestions?: AutocompleteSuggestionLike[] }) => {
          if (active) setSuggestions(res?.suggestions || []);
        })
        .catch((err: unknown) => {
          const msg = String((err as { message?: string })?.message || err || '');
          if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          if (active) setSuggestions([]);
        });
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [placesLib, value, focused]);

  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestionLike) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const loc = place.location;
      const addr = place.formattedAddress || suggestion.placePrediction.text.text;
      if (loc) {
        onPlaceSelected({
          address: addr,
          lat: loc.lat(),
          lng: loc.lng(),
        });
        onChange(addr);
      }
      sessionTokenRef.current = null;
      setSuggestions([]);
      setFocused(false);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#F5F6F7] border border-neutral-200 rounded-lg text-[#222222] placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-[#16A34A] transition-colors"
        />
      </div>

      {focused && (suggestions.length > 0 || (value.trim().length < 2 && presets.length > 0)) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-neutral-100">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                void handleSelectSuggestion(s);
              }}
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#F5F6F7] flex items-start gap-2.5"
            >
              <MapPin className="w-3.5 h-3.5 text-[#16A34A] mt-0.5 shrink-0" />
              <span className="text-[#222222] font-medium">
                {s.placePrediction?.text.text}
              </span>
            </button>
          ))}

          {suggestions.length === 0 &&
            presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPlaceSelected({
                    address: p.address,
                    lat: p.lat,
                    lng: p.lng,
                  });
                  onChange(p.address);
                  setFocused(false);
                }}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#F5F6F7] flex items-start gap-2.5"
              >
                <MapPin className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-[#222222]">{p.label}</div>
                  <div className="text-neutral-500 truncate">{p.address}</div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export function computeHaversineKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sinLat * sinLat +
          Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            sinLng *
            sinLng
      )
    );
  return Math.max(1.2, Number((R * c * 1.25).toFixed(1)));
}
