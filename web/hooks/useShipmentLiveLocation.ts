"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { TRACKING_CONFIG } from "@/lib/driver-tracking";
import { readShipmentLocation, writeShipmentLocation, toEpoch } from "@/lib/shipment-location-cache";

export interface LatestLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

interface UseShipmentLiveLocationOptions {
  shipmentId: string | number | null | undefined;
  initial?: { lat: number; lng: number; updatedAt?: number | string | Date | null } | null;
  enabled?: boolean;
  connectedPollMs?: number;
  disconnectedPollMs?: number;
}

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

  useEffect(() => {
    setLocation(readShipmentLocation(shipmentId));
  }, [shipmentId]);

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

  useEffect(() => {
    if (!initial || shipmentId == null) return;
    accept({ lat: initial.lat, lng: initial.lng, updatedAt: toEpoch(initial.updatedAt) });
  }, [initial?.lat, initial?.lng, initial?.updatedAt, shipmentId, accept]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!enabled || !socket || shipmentId == null) return;
    const handler = (payload: any) => {
      const incomingId = payload?.data?.shipmentId;
      if (incomingId == null || String(incomingId) !== String(shipmentId)) return;
      const coords: [number, number] | undefined = payload?.data?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [lat, lng] = coords;
      if (typeof lat !== "number" || typeof lng !== "number") return;
      const ts = toEpoch(payload?.data?.lastLocationUpdate ?? payload?.data?.timeStamp);
      accept({ lat, lng, updatedAt: ts });
    };
    socket.on("newCoordinates", handler);
    return () => {
      socket.off("newCoordinates", handler);
    };
  }, [enabled, socket, shipmentId, accept]);

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
