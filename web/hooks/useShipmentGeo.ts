"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Bounds,
  GeoPlace,
  PlaceNotFoundError,
  PlannedRoute,
  computeRoute,
  corridorBounds,
  mapsEnabled,
  searchPlace,
  straightLineMeters,
} from "@/lib/maps";
import { EVENT_LABELS } from "@/lib/labels";
import { Shipment, ShipmentEvent } from "@/types";

const GEO_QUERY = { staleTime: Infinity, gcTime: 60 * 60 * 1000, retry: false } as const;

export interface ShipmentGeo {
  origin?: GeoPlace;
  destination?: GeoPlace;
  route?: PlannedRoute | null;
  /** Driving distance when a route exists, otherwise the straight line. */
  distanceMeters?: number;
  distanceIsRoute: boolean;
  isLocating: boolean;
  /** Addresses Google could not place. */
  unresolved: string[];
  /** Any other failure (quota, network, key restrictions). */
  error?: Error;
}

/** Resolves a shipment's origin/destination and its planned driving route. */
export function useShipmentGeo(
  shipment: Pick<Shipment, "originAddress" | "destinationAddress"> | null | undefined,
  { withRoute = true }: { withRoute?: boolean } = {},
): ShipmentGeo {
  const enabled = mapsEnabled && Boolean(shipment);

  const origin = useQuery({
    queryKey: ["geo-place", shipment?.originAddress],
    queryFn: () => searchPlace(shipment!.originAddress),
    enabled,
    ...GEO_QUERY,
  });
  const destination = useQuery({
    queryKey: ["geo-place", shipment?.destinationAddress],
    queryFn: () => searchPlace(shipment!.destinationAddress),
    enabled,
    ...GEO_QUERY,
  });

  const o = origin.data;
  const d = destination.data;

  const route = useQuery({
    queryKey: ["geo-route", o?.lat, o?.lng, d?.lat, d?.lng],
    queryFn: () => computeRoute(o!, d!),
    enabled: withRoute && Boolean(o && d),
    ...GEO_QUERY,
  });

  const unresolved = [origin.error, destination.error]
    .filter((e): e is PlaceNotFoundError => e instanceof PlaceNotFoundError)
    .map((e) => e.query);
  const otherError = [origin.error, destination.error, route.error].find(
    (e) => e && !(e instanceof PlaceNotFoundError),
  ) as Error | undefined;

  return {
    origin: o,
    destination: d,
    route: route.data,
    distanceMeters: route.data?.distanceMeters ?? (o && d ? straightLineMeters(o, d) : undefined),
    distanceIsRoute: Boolean(route.data),
    isLocating: origin.isLoading || destination.isLoading || (withRoute && route.isLoading),
    unresolved,
    error: otherError,
  };
}

export interface MilestonePin {
  /** 1-based order of first report at this location. */
  index: number;
  locationName: string;
  place?: GeoPlace;
  /** Events reported at this location, oldest first. */
  events: { id: number; label: string; occurredAt: string }[];
  lastReportedAt: string;
  isLatest: boolean;
}

/**
 * Groups timeline events by their typed location and places each one on the
 * map, biased towards the shipment's corridor for ambiguous names.
 */
export function useMilestonePins(
  events: ShipmentEvent[] | undefined,
  corridor: { origin?: GeoPlace; destination?: GeoPlace; settled: boolean },
): { pins: MilestonePin[]; latest?: MilestonePin; unresolved: string[] } {
  const grouped = useMemo(() => {
    const located = (events ?? [])
      .filter((event) => event.locationName?.trim())
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const byName = new Map<string, Omit<MilestonePin, "index" | "isLatest" | "place">>();
    for (const event of located) {
      const name = event.locationName!.trim();
      const entry = byName.get(name.toLowerCase()) ?? { locationName: name, events: [], lastReportedAt: event.occurredAt };
      entry.events.push({ id: event.id, label: EVENT_LABELS[event.eventType] ?? event.eventType, occurredAt: event.occurredAt });
      entry.lastReportedAt = event.occurredAt;
      byName.set(name.toLowerCase(), entry);
    }
    return Array.from(byName.values());
  }, [events]);

  const bias: Bounds | undefined = corridorBounds(
    [corridor.origin, corridor.destination].filter(Boolean) as GeoPlace[],
  );

  const results = useQueries({
    queries: grouped.map((group) => ({
      queryKey: ["geo-place", group.locationName, bias && `${bias.south.toFixed(1)},${bias.west.toFixed(1)}`],
      queryFn: () => searchPlace(group.locationName, bias),
      // Wait for the corridor so the bias is applied consistently.
      enabled: mapsEnabled && corridor.settled,
      ...GEO_QUERY,
    })),
  });

  const latestAt = Math.max(0, ...grouped.map((g) => new Date(g.lastReportedAt).getTime()));
  const pins: MilestonePin[] = grouped.map((group, i) => ({
    ...group,
    index: i + 1,
    place: results[i]?.data,
    isLatest: new Date(group.lastReportedAt).getTime() === latestAt,
  }));

  return {
    pins,
    latest: pins.find((pin) => pin.isLatest),
    unresolved: pins.filter((_, i) => results[i]?.error instanceof PlaceNotFoundError).map((p) => p.locationName),
  };
}
