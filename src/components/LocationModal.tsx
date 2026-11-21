import React, { useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { AddressEntry } from '../types/unigo';
import { DEFAULT_LOCATIONS } from '../data/seedCatalog';
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput';

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  currentLocation: AddressEntry;
  savedLocations: AddressEntry[];
  onSelectLocation: (loc: AddressEntry) => void;
  onAddLocation: (loc: AddressEntry) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onClose,
  currentLocation,
  savedLocations,
  onSelectLocation,
  onAddLocation,
}) => {
  const [searchText, setSearchText] = useState('');
  const [customLabel, setCustomLabel] = useState('Other');

  if (!open) return null;

  const merged = [...savedLocations];
  for (const def of DEFAULT_LOCATIONS) {
    if (!merged.some((m) => m.id === def.id)) {
      merged.push(def);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-neutral-200 shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <h3 className="text-base font-bold text-[#222222]">
            Select Delivery Location
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location selector"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-[#F5F6F7]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            {(['Home', 'Work', 'Other'] as const).map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setCustomLabel(lbl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  customLabel === lbl
                    ? 'bg-[#16A34A] text-white border-[#16A34A]'
                    : 'bg-[#F5F6F7] text-[#222222] border-neutral-200'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <PlaceAutocompleteInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Search area, street or landmark..."
            presets={DEFAULT_LOCATIONS.map((d) => ({
              label: d.label,
              address: d.fullAddress,
              lat: d.lat,
              lng: d.lng,
            }))}
            onPlaceSelected={(place) => {
              const entry: AddressEntry = {
                id: `loc_${Date.now()}`,
                label: customLabel,
                fullAddress: place.address,
                zone: place.address.split(',').slice(-2, -1)[0]?.trim() || 'Bengaluru',
                lat: place.lat,
                lng: place.lng,
              };
              onAddLocation(entry);
              onSelectLocation(entry);
              setSearchText('');
              onClose();
            }}
          />
        </div>

        <div className="mt-5 overflow-y-auto space-y-2 pr-1">
          <div className="text-xs font-semibold text-neutral-500 mb-2">
            Saved & Popular Zones
          </div>
          {merged.map((loc) => {
            const active = loc.id === currentLocation.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  onClose();
                }}
                className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                  active
                    ? 'border-[#16A34A] bg-[#16A34A]/5'
                    : 'border-neutral-200 hover:bg-[#F5F6F7]'
                }`}
              >
                <MapPin
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    active ? 'text-[#16A34A]' : 'text-neutral-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#222222] flex items-center justify-between">
                    <span>{loc.label}</span>
                    {active && (
                      <span className="text-[11px] font-semibold text-[#16A34A]">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                    {loc.fullAddress}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {searchText.trim().length > 4 && (
          <button
            type="button"
            onClick={() => {
              const entry: AddressEntry = {
                id: `loc_${Date.now()}`,
                label: customLabel,
                fullAddress: searchText.trim(),
                zone: 'Indiranagar, Bengaluru',
                lat: 12.9784,
                lng: 77.6408,
              };
              onAddLocation(entry);
              onSelectLocation(entry);
              setSearchText('');
              onClose();
            }}
            className="mt-3 w-full py-2.5 rounded-lg bg-[#222222] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Use "{searchText.trim()}"</span>
          </button>
        )}
      </div>
    </div>
  );
};
