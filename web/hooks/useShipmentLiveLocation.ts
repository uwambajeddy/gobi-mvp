"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { TRACKING_CONFIG } from "@/lib/driver-tracking";
import { readShipmentLocation, writeShipmentLocation, toEpoch } from "@/lib/shipment-location-cache";

/**
 * Unified "latest shipment location" hook.
 *
 * Single source of truth for the most recent known position of the driver
 * carrying a shipment, regardless of how the update arrived:
 *   - Driver `watchPosition` → socket `newCoordinates`
 *   - Initial REST load → `shipment.currentLocation`
 *
 * Behaviour:
 *   - Seeds synchronously from localStorage so the map opens at the last
 *     known position even on a cold reload.
 *   - Hydrates from the REST tracking endpoint.
 *   - Subscribes to the realtime `newCoordinates` socket event scoped to
 *     this shipment.
 *   - Polls the tracking endpoint as a safety net (more frequently when
 *     socket disconnected).
 *   - Writes every accepted update back to localStorage.
 */

export interface LatestLocation {
  lat: number;
  lng: number;
  /** ms epoch when the server received this fix. */
  updatedAt: number;
}

interface UseShipmentLiveLocationOptions {
  shipmentId: string | number | null | undefined;
  /** Initial value from the parent's REST fetch (used if the cache is empty/older). */
  initial?: { lat: number; lng: number; updatedAt?: number | string | Date | null } | null;
  /** Disable the entire hook (e.g. when the shipment is not in transit). */
  enabled?: boolean;
  /** Poll cadence when the socket is connected (ms). */
  connectedPollMs?: number;
  /** Poll cadence when the socket is disconnected (ms). */
  disconnectedPollMs?: number;
}

/** A parked truck still reports every MAX_SILENT_INTERVAL, so only flag silence beyond that. */
const STALE_AFTER_MS = TRACKING_CONFIG.MAX_SILENT_INTERVAL_MS + 30_000;

export function useShipmentLiveLocation({
  shipmentId,
  initial,
  enabled = true,
  connectedPollMs = 30_000,
  disconnectedPollMs = 8_000,
}: UseShipmentLiveLocationOptions): {
  location: LatestLocation | null;
  isStale: boolean;
  refresh: () => Promise<void>;
} {
  const { socket, connected } = useSocket();
  const axiosAuth = useAxiosAuth();

  // Synchronous seed from cache → no flash of "no location" on cold load.
  const [location, setLocation] = useState<LatestLocation | null>(() => readShipmentLocation(shipmentId));
  const [isStale, setIsStale] = useState(false);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // When shipmentId changes, re-seed from its cache entry.
  useEffect(() => {
    setLocation(readShipmentLocation(shipmentId));
  }, [shipmentId]);

  // Accept and persist a new candidate location. Only writes when the
  // incoming update is newer than what we already have; the staleness flag
  // follows the kept location's age (below), so an old repeat can't reset it.
  const accept = useCallback(
    (next: LatestLocation) => {
      if (!mountedRef.current || shipmentId == null) return;
      setLocation((prev) => {
        if (prev && next.updatedAt <= prev.updatedAt) return prev;
        writeShipmentLocation(shipmentId, next);
        return next;
      });
    },
    [shipmentId],
  );

  // Seed from the parent's `initial` value if provided and newer than cache.
  useEffect(() => {
    if (!initial || shipmentId == null) return;
    accept({ lat: initial.lat, lng: initial.lng, updatedAt: toEpoch(initial.updatedAt) });
  }, [initial?.lat, initial?.lng, initial?.updatedAt, shipmentId, accept]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- REST refresh ----
  const fetchLatest = useCallback(async () => {
    if (!enabled || shipmentId == null) return;
    try {
      const res = await axiosAuth.get(`/api/v1/shipments/${shipmentId}/tracking`);
      const tracking = res.data?.data?.tracking;
      const cl = tracking?.currentLocation;
      if (typeof cl?.lat !== "number" || typeof cl?.lng !== "number") return;
      accept({ lat: cl.lat, lng: cl.lng, updatedAt: toEpoch(tracking.lastLocationUpdate) });
    } catch {
      /* ignore — socket / next poll will catch up */
    }
  }, [accept, axiosAuth, shipmentId, enabled]);

  // Initial fetch + interval polling.
  useEffect(() => {
    if (!enabled || shipmentId == null) return;
    void fetchLatest();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchLatest, connected ? connectedPollMs : disconnectedPollMs);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [enabled, shipmentId, connected, fetchLatest, connectedPollMs, disconnectedPollMs]);

  // ---- Socket subscription ----
  useEffect(() => {
    if (!enabled || !socket || shipmentId == null) return;
    const handler = (payload: any) => {
      const incomingId = payload?.data?.shipmentId;
      if (incomingId == null || String(incomingId) !== String(shipmentId)) return;
      const coords: [number, number] | undefined = payload?.data?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [lat, lng] = coords;
      if (typeof lat !== "number" || typeof lng !== "number") return;
      // Ordered by the server's clock (the same field the REST endpoint
      // returns), so a phone with a wrong clock can't hold back newer fixes.
      const ts = toEpoch(payload?.data?.lastLocationUpdate ?? payload?.data?.timeStamp);
      accept({ lat, lng, updatedAt: ts });
    };
    socket.on("newCoordinates", handler);
    return () => {
      socket.off("newCoordinates", handler);
    };
  }, [enabled, socket, shipmentId, accept]);

  // ---- Staleness flag ----
  useEffect(() => {
    if (!location) {
      setIsStale(false);
      return;
    }
    const tick = () => {
      setIsStale(Date.now() - location.updatedAt > STALE_AFTER_MS);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [location]);

  return { location, isStale, refresh: fetchLatest };
}
