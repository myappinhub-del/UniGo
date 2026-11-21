import React, { useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  Circle,
  Map as GoogleMap,
  MapMouseEvent,
  Pin,
  Polygon,
  useApiIsLoaded,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { Crosshair, Hexagon, LocateFixed, RotateCcw, Trash2 } from 'lucide-react';
import { FranchiseZone, LatLngLiteral } from '../types/unigo';
import { DEFAULT_LOCATIONS } from '../data/seedCatalog';
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput';

export interface FranchiseBoundaryValue {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  boundaryMode: 'radius' | 'polygon';
  boundaryPoints: LatLngLiteral[];
}

interface FranchiseBoundaryMapEditorProps {
  apiKey: string;
  value: FranchiseBoundaryValue;
  onChange: (next: FranchiseBoundaryValue) => void;
  existingZones?: FranchiseZone[];
  editingZoneId?: string | null;
}

function generateHexagonPoints(center: LatLngLiteral, radiusKm: number): LatLngLiteral[] {
  const latDegPerKm = 1 / 111.32;
  const lngDegPerKm = 1 / (111.32 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
  const points: LatLngLiteral[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    points.push({
      lat: Number((center.lat + radiusKm * latDegPerKm * Math.sin(angle)).toFixed(6)),
      lng: Number((center.lng + radiusKm * lngDegPerKm * Math.cos(angle)).toFixed(6)),
    });
  }
  return points;
}

export const FranchiseBoundaryMapEditor: React.FC<FranchiseBoundaryMapEditorProps> = ({
  apiKey,
  value,
  onChange,
  existingZones = [],
  editingZoneId,
}) => {
  const isLoaded = useApiIsLoaded();
  const loadingStatus = useApiLoadingStatus();
  const [mapFailed, setMapFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngLiteral>({
    lat: value.centerLat,
    lng: value.centerLng,
  });

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.FAILED ||
      loadingStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      setMapFailed(true);
    }
  }, [loadingStatus]);

  useEffect(() => {
    setMapCenter({ lat: value.centerLat, lng: value.centerLng });
  }, [value.centerLat, value.centerLng]);

  const presets = useMemo(
    () =>
      DEFAULT_LOCATIONS.map((d) => ({
        label: d.label,
        address: d.fullAddress,
        lat: d.lat,
        lng: d.lng,
      })),
    []
  );

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS geolocation is not supported in this browser.');
      return;
    }
    setGpsLoading(true);
    setGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setMapCenter({ lat, lng });
        onChange({
          ...value,
          centerLat: lat,
          centerLng: lng,
          boundaryPoints:
            value.boundaryMode === 'polygon' && value.boundaryPoints.length === 0
              ? generateHexagonPoints({ lat, lng }, value.radiusKm)
              : value.boundaryPoints,
        });
        setGpsStatus(`Locked to GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        setGpsLoading(false);
      },
      (err) => {
        setGpsStatus(
          err.code === 1
            ? 'Location permission denied. Search an area or click directly on the map.'
            : 'Unable to read GPS signal. Click the map or search an area.'
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const handleMapClick = (e: MapMouseEvent) => {
    const latLng = e.detail?.latLng;
    if (!latLng) return;
    const clicked: LatLngLiteral = {
      lat: Number(latLng.lat.toFixed(6)),
      lng: Number(latLng.lng.toFixed(6)),
    };

    if (value.boundaryMode === 'polygon') {
      if (value.boundaryPoints.length >= 25) {
        setGpsStatus('Maximum 25 boundary points reached.');
        return;
      }
      const nextPts = [...value.boundaryPoints, clicked];
      const avgLat = nextPts.reduce((s, p) => s + p.lat, 0) / nextPts.length;
      const avgLng = nextPts.reduce((s, p) => s + p.lng, 0) / nextPts.length;
      onChange({
        ...value,
        centerLat: Number(avgLat.toFixed(6)),
        centerLng: Number(avgLng.toFixed(6)),
        boundaryPoints: nextPts,
      });
    } else {
      onChange({
        ...value,
        centerLat: clicked.lat,
        centerLng: clicked.lng,
      });
    }
  };

  const handleModeSwitch = (mode: 'radius' | 'polygon') => {
    if (mode === 'polygon' && value.boundaryPoints.length < 3) {
      onChange({
        ...value,
        boundaryMode: 'polygon',
        boundaryPoints: generateHexagonPoints(
          { lat: value.centerLat, lng: value.centerLng },
          value.radiusKm
        ),
      });
    } else {
      onChange({
        ...value,
        boundaryMode: mode,
      });
    }
  };

  const otherZones = useMemo(
    () =>
      existingZones.filter(
        (z) => z.id !== editingZoneId && typeof z.centerLat === 'number' && typeof z.centerLng === 'number'
      ),
    [existingZones, editingZoneId]
  );

  return (
    <div className="space-y-3">
      {/* Top GPS & Search Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <PlaceAutocompleteInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search area or city to center boundary..."
            presets={presets}
            onPlaceSelected={(place) => {
              const lat = Number(place.lat.toFixed(6));
              const lng = Number(place.lng.toFixed(6));
              setMapCenter({ lat, lng });
              onChange({
                ...value,
                centerLat: lat,
                centerLng: lng,
                boundaryPoints:
                  value.boundaryMode === 'polygon'
                    ? generateHexagonPoints({ lat, lng }, value.radiusKm)
                    : value.boundaryPoints,
              });
              setGpsStatus(`Centered on ${place.address}`);
            }}
          />
        </div>

        <button
          type="button"
          disabled={gpsLoading}
          onClick={handleUseCurrentGps}
          className="px-3.5 py-2 rounded-lg bg-[#222222] hover:bg-[#16A34A] text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors disabled:opacity-60"
        >
          <LocateFixed className="w-3.5 h-3.5" />
          <span>{gpsLoading ? 'Reading GPS...' : 'Use My GPS'}</span>
        </button>
      </div>

      {/* Mode Switch & Quick Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F6F7] border border-neutral-200 rounded-xl p-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleModeSwitch('radius')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              value.boundaryMode === 'radius'
                ? 'bg-[#16A34A] text-white'
                : 'bg-white text-[#222222] border border-neutral-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>GPS Radius</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('polygon')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              value.boundaryMode === 'polygon'
                ? 'bg-[#16A34A] text-white'
                : 'bg-white text-[#222222] border border-neutral-200'
            }`}
          >
            <Hexagon className="w-3.5 h-3.5" />
            <span>Custom Polygon ({value.boundaryPoints.length})</span>
          </button>
        </div>

        {value.boundaryMode === 'radius' ? (
          <div className="flex items-center gap-2.5 text-xs">
            <span className="font-semibold text-neutral-600">Radius:</span>
            <input
              type="range"
              min={0.5}
              max={25}
              step={0.5}
              value={value.radiusKm}
              onChange={(e) =>
                onChange({ ...value, radiusKm: Number(e.target.value) })
              }
              className="w-28 accent-[#16A34A]"
            />
            <span className="font-extrabold text-[#16A34A] tabular-nums w-14 text-right">
              {value.radiusKm} km
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  boundaryPoints: generateHexagonPoints(
                    { lat: value.centerLat, lng: value.centerLng },
                    value.radiusKm
                  ),
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-[11px] font-bold text-[#222222] hover:border-[#16A34A]"
            >
              Auto-Hexagon
            </button>
            <button
              type="button"
              disabled={value.boundaryPoints.length === 0}
              onClick={() =>
                onChange({
                  ...value,
                  boundaryPoints: value.boundaryPoints.slice(0, -1),
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 text-[11px] font-bold text-[#222222] disabled:opacity-40 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={value.boundaryPoints.length === 0}
              onClick={() =>
                onChange({
                  ...value,
                  boundaryPoints: [],
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-white border border-red-200 text-[11px] font-bold text-red-600 disabled:opacity-40 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {gpsStatus && (
        <div className="text-[11px] font-medium text-[#16A34A] px-1">
          {gpsStatus}
        </div>
      )}

      {/* Interactive Map Canvas */}
      {!apiKey || mapFailed ? (
        <div className="w-full h-64 rounded-xl border border-neutral-200 bg-[#F5F6F7] flex flex-col items-center justify-center p-5 text-center space-y-2">
          <LocateFixed className="w-6 h-6 text-[#16A34A]" />
          <div className="text-xs font-bold text-[#222222]">
            GPS Boundary Coordinates Configured
          </div>
          <div className="text-[11px] text-neutral-600 tabular-nums">
            Center: {value.centerLat.toFixed(5)}, {value.centerLng.toFixed(5)} · Coverage:{' '}
            {value.boundaryMode === 'polygon'
              ? `${value.boundaryPoints.length} polygon vertices`
              : `${value.radiusKm} km radius`}
          </div>
        </div>
      ) : (
        <div className="w-full h-72 rounded-xl overflow-hidden border border-neutral-200 relative bg-[#F5F6F7]">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#F5F6F7] z-10 text-xs text-neutral-500">
              Loading GPS boundary map...
            </div>
          )}
          <GoogleMap
            mapId="DEMO_MAP_ID"
            center={mapCenter}
            defaultCenter={mapCenter}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={true}
            zoomControl={true}
            onClick={handleMapClick}
            onCameraChanged={(ev) => {
              const c = ev.detail.center;
              if (c) setMapCenter({ lat: c.lat, lng: c.lng });
            }}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Reference Existing Zones */}
            {otherZones.map((oz) => {
              const ozCenter = { lat: oz.centerLat!, lng: oz.centerLng! };
              if (oz.boundaryMode === 'polygon' && oz.boundaryPoints && oz.boundaryPoints.length >= 3) {
                return (
                  <Polygon
                    key={oz.id}
                    paths={[oz.boundaryPoints]}
                    strokeColor="#64748B"
                    strokeOpacity={0.6}
                    strokeWeight={1.5}
                    fillColor="#94A3B8"
                    fillOpacity={0.12}
                    clickable={false}
                  />
                );
              }
              return (
                <Circle
                  key={oz.id}
                  center={ozCenter}
                  radius={(oz.radiusKm ?? 4) * 1000}
                  strokeColor="#64748B"
                  strokeOpacity={0.6}
                  strokeWeight={1.5}
                  fillColor="#94A3B8"
                  fillOpacity={0.12}
                  clickable={false}
                />
              );
            })}

            {/* Active Editable Zone Center Pin */}
            <AdvancedMarker
              position={{ lat: value.centerLat, lng: value.centerLng }}
              title="Franchise Hub Center"
            >
              <Pin background="#16A34A" borderColor="#14532D" glyphColor="#FFFFFF" />
            </AdvancedMarker>

            {value.boundaryMode === 'radius' && (
              <Circle
                center={{ lat: value.centerLat, lng: value.centerLng }}
                radius={value.radiusKm * 1000}
                editable
                draggable
                strokeColor="#16A34A"
                strokeOpacity={0.95}
                strokeWeight={2.5}
                fillColor="#16A34A"
                fillOpacity={0.18}
                onCenterChanged={(newCenter) => {
                  if (!newCenter) return;
                  onChange({
                    ...value,
                    centerLat: Number(newCenter.lat().toFixed(6)),
                    centerLng: Number(newCenter.lng().toFixed(6)),
                  });
                }}
                onRadiusChanged={(newMeters) => {
                  if (!Number.isFinite(newMeters)) return;
                  const km = Math.min(150, Math.max(0.2, Number((newMeters / 1000).toFixed(1))));
                  onChange({
                    ...value,
                    radiusKm: km,
                  });
                }}
              />
            )}

            {value.boundaryMode === 'polygon' && (
              <>
                {value.boundaryPoints.map((pt, idx) => (
                  <AdvancedMarker
                    key={`${idx}-${pt.lat}-${pt.lng}`}
                    position={pt}
                    title={`Boundary Point ${idx + 1}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-[#222222] text-white text-[10px] font-bold border-2 border-white shadow flex items-center justify-center">
                      {idx + 1}
                    </div>
                  </AdvancedMarker>
                ))}
                {value.boundaryPoints.length >= 3 && (
                  <Polygon
                    paths={[value.boundaryPoints]}
                    strokeColor="#16A34A"
                    strokeOpacity={0.95}
                    strokeWeight={2.5}
                    fillColor="#16A34A"
                    fillOpacity={0.2}
                    clickable={false}
                  />
                )}
              </>
            )}
          </GoogleMap>

          <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-white/95 border border-neutral-200 text-[11px] font-semibold text-[#222222] shadow-sm">
              {value.boundaryMode === 'radius'
                ? 'Click map or drag circle handles to set coverage'
                : 'Click map to place polygon corners (3+ points)'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/95 border border-neutral-200 text-[11px] font-mono text-neutral-700 shadow-sm tabular-nums">
              {value.centerLat.toFixed(4)}, {value.centerLng.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
