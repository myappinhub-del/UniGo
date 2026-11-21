import React, { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { LatLngLiteral } from '../types/unigo';
import { MapPin, Navigation } from 'lucide-react';

export interface RouteStepInfo {
  instruction: string;
  distanceText: string;
}

export interface ComputedDirectionsInfo {
  distanceKm: number;
  durationMinutes: number;
  steps: RouteStepInfo[];
}

interface RouteOverlayProps {
  origin: LatLngLiteral | string | null;
  destination: LatLngLiteral | string | null;
  travelMode: 'DRIVING' | 'TWO_WHEELER';
  onRouteComputed?: (distanceKm: number, durationMinutes: number) => void;
  onDirectionsReady?: (info: ComputedDirectionsInfo) => void;
}

interface PolylineLike {
  setOptions: (opts: Record<string, unknown>) => void;
  setMap: (map: unknown | null) => void;
}

function formatStepDistance(meters?: number): string {
  if (!meters || meters <= 0) return '';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function RouteOverlay({
  origin,
  destination,
  travelMode,
  onRouteComputed,
  onDirectionsReady,
}: RouteOverlayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<PolylineLike[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const requestOrigin =
      typeof origin === 'string'
        ? origin
        : { lat: origin.lat, lng: origin.lng };
    const requestDest =
      typeof destination === 'string'
        ? destination
        : { lat: destination.lat, lng: destination.lng };

    const request = {
      origin: requestOrigin,
      destination: requestDest,
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    let cancelled = false;

    (routesLib.Route as any)
      .computeRoutes(request)
      .then(({ routes }: { routes: any[] }) => {
        if (cancelled || !routes || routes.length === 0) return;
        const primaryRoute = routes[0];
        const newPolylines: PolylineLike[] = primaryRoute.createPolylines();
        newPolylines.forEach((polyline: PolylineLike) => {
          polyline.setOptions({
            strokeColor: '#16A34A',
            strokeWeight: 5,
            strokeOpacity: 0.92,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const km = Number(((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1));
        const mins = Math.max(4, Math.round((primaryRoute.durationMillis ?? 0) / 60000));

        const extractedSteps: RouteStepInfo[] = [];
        if (Array.isArray(primaryRoute.legs)) {
          for (const leg of primaryRoute.legs) {
            if (Array.isArray(leg.steps)) {
              for (const step of leg.steps) {
                const instr =
                  step?.navigationInstruction?.instructions ||
                  step?.instructions ||
                  '';
                if (instr) {
                  extractedSteps.push({
                    instruction: String(instr),
                    distanceText: formatStepDistance(step.distanceMeters),
                  });
                }
              }
            }
          }
        }

        onRouteComputed?.(km, mins);
        onDirectionsReady?.({
          distanceKm: km,
          durationMinutes: mins,
          steps: extractedSteps,
        });
      })
      .catch((err: any) => {
        const msg = String(err?.message || err || '');
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        console.warn('Routes API fallback to Haversine estimate:', err);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, destination, travelMode, onRouteComputed, onDirectionsReady]);

  return null;
}

interface GoogleMapsViewProps {
  apiKey: string;
  origin: LatLngLiteral;
  destination: LatLngLiteral | null;
  partnerPosition?: LatLngLiteral | null;
  originLabel?: string;
  destinationLabel?: string;
  travelMode?: 'DRIVING' | 'TWO_WHEELER';
  heightClass?: string;
  onRouteComputed?: (distanceKm: number, durationMinutes: number) => void;
  onDirectionsReady?: (info: ComputedDirectionsInfo) => void;
}

export const GoogleMapsView: React.FC<GoogleMapsViewProps> = ({
  apiKey,
  origin,
  destination,
  partnerPosition,
  originLabel = 'Pickup Location',
  destinationLabel = 'Drop Destination',
  travelMode = 'DRIVING',
  heightClass = 'h-64 md:h-80',
  onRouteComputed,
  onDirectionsReady,
}) => {
  const isLoaded = useApiIsLoaded();
  const loadingStatus = useApiLoadingStatus();
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.FAILED ||
      loadingStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      setMapFailed(true);
    }
  }, [loadingStatus]);

  if (!apiKey || mapFailed) {
    return (
      <div
        className={`w-full ${heightClass} rounded-xl border border-neutral-200 bg-[#F5F6F7] flex flex-col items-center justify-center p-5 text-center`}
      >
        <div className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center mb-2.5 text-[#16A34A]">
          <Navigation className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-[#222222]">
          Route Preview Ready
        </p>
        <p className="text-xs text-neutral-500 mt-1 max-w-xs">
          {originLabel} ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})
          {destination
            ? ` to ${destinationLabel} (${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)})`
            : ''}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full ${heightClass} rounded-xl overflow-hidden border border-neutral-200 relative bg-[#F5F6F7]`}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F5F6F7] z-10 text-xs text-neutral-500">
          Loading interactive map...
        </div>
      )}
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={origin}
        center={origin}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={true}
        zoomControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={origin} title={originLabel}>
          <Pin background="#16A34A" borderColor="#14532D" glyphColor="#FFFFFF" />
        </AdvancedMarker>

        {destination && (
          <AdvancedMarker position={destination} title={destinationLabel}>
            <Pin background="#222222" borderColor="#000000" glyphColor="#FFFFFF" />
          </AdvancedMarker>
        )}

        {partnerPosition && (
          <AdvancedMarker position={partnerPosition} title="Delivery Partner GPS">
            <div className="w-8 h-8 rounded-full bg-[#16A34A] border-2 border-white shadow-md flex items-center justify-center text-white">
              <MapPin className="w-4 h-4" />
            </div>
          </AdvancedMarker>
        )}

        {destination && (
          <RouteOverlay
            origin={origin}
            destination={destination}
            travelMode={travelMode}
            onRouteComputed={onRouteComputed}
            onDirectionsReady={onDirectionsReady}
          />
        )}
      </GoogleMap>
    </div>
  );
};
