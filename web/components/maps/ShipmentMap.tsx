"use client";

import { useEffect, useMemo } from "react";
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  ControlPosition,
  Map as GoogleMap,
  Polyline,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { AlertTriangle, Info, Loader2, MapPinOff } from "lucide-react";

import { cn, formatDateTime, formatRelative } from "@/lib/utils";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, LatLng, mapsEnabled } from "@/lib/maps";
import type { MilestonePin, ShipmentGeo } from "@/hooks/useShipmentGeo";

const EAST_AFRICA: LatLng = { lat: -2.5, lng: 33.5 };
const ROUTE_COLOR = "#F36A46";

type Padding = { top: number; right: number; bottom: number; left: number };

/* ------------------------------------------------------------------ */
/* Markers                                                              */
/* ------------------------------------------------------------------ */

function EndpointPin({ letter, label, tone }: { letter: string; label: string; tone: "pickup" | "dropoff" }) {
  return (
    <div className="relative">
      <div className="flex flex-col items-center drop-shadow-[0_3px_6px_rgba(16,24,40,0.3)]">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[0.8125rem] font-bold text-white",
            tone === "pickup" ? "bg-success" : "bg-primary-600",
          )}
        >
          {letter}
        </span>
        <span
          aria-hidden
          className={cn(
            "-mt-1 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent",
            tone === "pickup" ? "border-t-success" : "border-t-primary-600",
          )}
        />
      </div>
      <span
        className={cn(
          "absolute left-full top-1 ml-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold text-white shadow-sm",
          tone === "pickup" ? "bg-success-fg" : "bg-primary-700",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function MilestoneDot({ pin }: { pin: MilestonePin }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full border-2 font-bold shadow-md",
        pin.isLatest
          ? "h-7 w-7 border-white bg-primary-500 text-[0.75rem] text-white ring-4 ring-primary-500/25"
          : "h-6 w-6 border-primary-500 bg-white text-[0.6875rem] text-primary-700",
      )}
    >
      {pin.index}
    </span>
  );
}

const pinTitle = (pin: MilestonePin) =>
  `${pin.index}. ${pin.locationName}: ${pin.events.map((e) => e.label).join(", ")} · last ${formatDateTime(
    pin.lastReportedAt,
  )} (${formatRelative(pin.lastReportedAt)})`;

/* ------------------------------------------------------------------ */
/* Behaviour                                                            */
/* ------------------------------------------------------------------ */

/** Re-centres the map whenever the set of points changes. */
function FitBounds({ points, padding }: { points: LatLng[]; padding: Padding }) {
  const map = useMap();
  const signature = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");

  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(10);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, padding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature, padding.top, padding.right, padding.bottom, padding.left]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Status pills                                                         */
/* ------------------------------------------------------------------ */

function StatusPill({ tone, children }: { tone: "info" | "warning" | "danger" | "neutral"; children: React.ReactNode }) {
  const Icon = tone === "neutral" ? Loader2 : tone === "info" ? Info : AlertTriangle;
  return (
    <span
      className={cn(
        "pointer-events-auto inline-flex max-w-full items-center gap-1.5 rounded-full border bg-surface/95 px-2.5 py-1 text-caption font-medium shadow-raised backdrop-blur",
        tone === "info" && "border-info-line text-info-fg",
        tone === "warning" && "border-warning-line text-warning-fg",
        tone === "danger" && "border-danger-line text-danger-fg",
        tone === "neutral" && "border-line text-ink-secondary",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", tone === "neutral" && "animate-spin")} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Map                                                                  */
/* ------------------------------------------------------------------ */

interface ShipmentMapProps {
  geo: ShipmentGeo;
  pins?: MilestonePin[];
  pinsUnresolved?: string[];
  className?: string;
  /** Keeps the fitted route clear of overlays such as a floating card. */
  fitPadding?: Padding;
  /** Rendered over the map (e.g. a details card). */
  children?: React.ReactNode;
  /** Accessible description of what the map shows. */
  label: string;
}

function MapCanvas({ geo, pins = [], pinsUnresolved = [], fitPadding }: ShipmentMapProps) {
  const status = useApiLoadingStatus();
  const { origin, destination, route } = geo;

  const placedPins = pins.filter((pin) => pin.place);
  const linePath = useMemo<LatLng[]>(
    () => route?.path ?? (origin && destination ? [origin, destination] : []),
    [route, origin, destination],
  );
  const fitPoints = useMemo<LatLng[]>(
    () => [
      ...(route?.path ?? []),
      ...(origin ? [origin] : []),
      ...(destination ? [destination] : []),
      ...placedPins.map((pin) => pin.place!),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, origin, destination, placedPins.length],
  );

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MapPinOff className="h-6 w-6 text-ink-muted" aria-hidden />
        <p className="text-label font-semibold text-ink">Google Maps couldn&apos;t load</p>
        <p className="max-w-xs text-caption text-ink-muted">
          Check that the Maps JavaScript API is enabled for this key and that the key allows this site.
        </p>
      </div>
    );
  }

  const notices: { tone: "info" | "warning" | "danger" | "neutral"; text: string }[] = [];
  if (geo.isLocating) notices.push({ tone: "neutral", text: "Locating places…" });
  if (geo.unresolved.length) notices.push({ tone: "warning", text: `Couldn't place: ${geo.unresolved.join(", ")}` });
  if (!geo.isLocating && origin && destination && route === null) {
    notices.push({ tone: "info", text: "No driving route found · straight line shown" });
  }
  if (pinsUnresolved.length) {
    notices.push({
      tone: "warning",
      text: `${pinsUnresolved.length} milestone location${pinsUnresolved.length === 1 ? "" : "s"} not found`,
    });
  }
  if (geo.error) notices.push({ tone: "danger", text: `Map data unavailable: ${geo.error.message}` });

  return (
    <>
      <GoogleMap
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={EAST_AFRICA}
        defaultZoom={5}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
        // Top right keeps zoom clear of overlays docked at the bottom.
        zoomControlOptions={{ position: ControlPosition.RIGHT_TOP }}
        clickableIcons={false}
        className="h-full w-full"
      >
        {linePath.length > 1 && (
          <>
            <Polyline path={linePath} strokeColor="#FFFFFF" strokeOpacity={0.9} strokeWeight={8} zIndex={1} geodesic={!route} />
            <Polyline
              path={linePath}
              strokeColor={ROUTE_COLOR}
              strokeOpacity={route ? 1 : 0}
              strokeWeight={4}
              zIndex={2}
              geodesic={!route}
              icons={
                route
                  ? undefined
                  : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: ROUTE_COLOR, scale: 3 }, offset: "0", repeat: "14px" }]
              }
            />
          </>
        )}

        {origin && (
          <AdvancedMarker
            position={origin}
            anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
            title={`Pickup: ${origin.formattedAddress}`}
            zIndex={30}
          >
            <EndpointPin letter="P" label="Pickup" tone="pickup" />
          </AdvancedMarker>
        )}
        {destination && (
          <AdvancedMarker
            position={destination}
            anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
            title={`Drop-off: ${destination.formattedAddress}`}
            zIndex={30}
          >
            <EndpointPin letter="D" label="Drop-off" tone="dropoff" />
          </AdvancedMarker>
        )}
        {placedPins.map((pin) => (
          <AdvancedMarker
            key={pin.locationName}
            position={pin.place!}
            anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
            title={pinTitle(pin)}
            zIndex={pin.isLatest ? 25 : 20}
          >
            <MilestoneDot pin={pin} />
          </AdvancedMarker>
        ))}

        <FitBounds points={fitPoints} padding={fitPadding ?? { top: 56, right: 56, bottom: 56, left: 56 }} />
      </GoogleMap>

      {notices.length > 0 && (
        <div className="pointer-events-none absolute left-3 right-14 top-3 flex flex-col items-start gap-1.5" aria-live="polite">
          {notices.map((notice) => (
            <StatusPill key={notice.text} tone={notice.tone}>
              {notice.text}
            </StatusPill>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Planned route (pickup → drop-off) plus every milestone location reported
 * on the timeline. There is no live GPS: positions come from typed places.
 */
export function ShipmentMap(props: ShipmentMapProps) {
  const { className, children, label } = props;

  if (!mapsEnabled) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-surface-muted p-6 text-center", className)}>
        <MapPinOff className="h-6 w-6 text-ink-muted" aria-hidden />
        <p className="text-label font-semibold text-ink">Map unavailable</p>
        <p className="max-w-xs text-caption text-ink-muted">
          Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show routes and reported locations.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["marker"]}>
      <div role="region" aria-label={label} className={cn("relative isolate overflow-hidden bg-surface-sunken", className)}>
        <MapCanvas {...props} />
        {children}
      </div>
    </APIProvider>
  );
}
