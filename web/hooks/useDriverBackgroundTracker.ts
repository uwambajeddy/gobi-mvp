"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSocket } from "@/context/SocketContext";
import { apiErrorMessage } from "@/lib/handleApiError";
import { straightLineMeters } from "@/lib/maps";
import { isTrackingActive } from "@/lib/shipments";
import {
  TRACKING_CONFIG,
  loadDriverTrackingPrefs,
  saveDriverTrackingPrefs,
  type DriverTrackingPrefs,
} from "@/lib/driver-tracking";
import { Shipment } from "@/types";

/**
 * Driver location tracker.
 *
 * Responsibilities
 * ----------------
 * - When the current user is a driver AND has a shipment on the road (from
 *   "Going to pickup" until arrival) AND has tracking switched on: subscribe
 *   to `navigator.geolocation.watchPosition`
 *   and stream coordinates to the server.
 * - Throttle outgoing updates (time + distance) to avoid flooding.
 * - Send each fix on the realtime socket (`newCoordinates`, best-effort) and
 *   save it over REST (authoritative, kept on the shipment).
 * - Track and surface permission state, support state, last send timestamp.
 *
 * Limitations
 * -----------
 * Browsers only report GPS to a page that is running. When the OS suspends
 * the page (screen locked, iOS background), tracking pauses and resumes
 * automatically on next visibility / next position fix.
 */

export type TrackingState =
  | "idle"
  | "disabled"
  | "unsupported"
  | "denied"
  | "prompt"
  | "active";

export interface DriverTrackerStatus {
  state: TrackingState;
  prefs: DriverTrackingPrefs;
  permission: PermissionState | "unknown";
  lastFixAt: number | null;
  lastSendAt: number | null;
  lastCoords: { lat: number; lng: number } | null;
  online: boolean;
  socketConnected: boolean;
  hasActiveShipment: boolean;
  activeShipments: Pick<Shipment, "id" | "reference">[];
  error: string | null;
  setEnabled: (enabled: boolean) => void;
}

export function useDriverBackgroundTracker(): DriverTrackerStatus {
  const { data: session, status: sessionStatus } = useSession();
  const { memberships } = useActiveOrg();
  const { socket, connected: socketConnected, updateShipmentLocation } = useSocket();
  const axiosAuth = useAxiosAuth();

  const isDriver = memberships.some((m) => m.role === "driver");
  const userId = session?.user?.id;

  const { data: activeShipments = [] } = useQuery({
    queryKey: ["shipments", "driver-tracking"],
    queryFn: async () => (await axiosAuth.get("/api/v1/shipments")).data.data.shipments as Shipment[],
    select: (shipments) =>
      shipments
        .filter((shipment) => shipment.assignedDriverId === userId && isTrackingActive(shipment))
        .map(({ id, reference }) => ({ id, reference })),
    enabled: sessionStatus === "authenticated" && isDriver,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const [prefs, setPrefs] = useState<DriverTrackingPrefs>(() => loadDriverTrackingPrefs());
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [lastSendAt, setLastSendAt] = useState<number | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TrackingState>("idle");

  const lastSentCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSentTimeRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const hasActiveShipment = activeShipments.length > 0;
  const shipmentIdsKey = activeShipments.map((shipment) => shipment.id).join(",");

  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const setEnabled = useCallback((enabled: boolean) => {
    setPrefs(saveDriverTrackingPrefs({ enabled }));
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        setPermission(s.state);
        s.onchange = () => setPermission(s.state);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  const shouldTrack =
    sessionStatus === "authenticated" &&
    isDriver &&
    hasActiveShipment &&
    prefs.enabled &&
    supported &&
    permission !== "denied";

  const sendCoordinates = useCallback(
    async (coords: { lat: number; lng: number }, force: boolean) => {
      if (!shipmentIdsKey) return;
      const now = Date.now();
      const sinceLast = now - lastSentTimeRef.current;
      const prev = lastSentCoordsRef.current;
      const moved = prev ? straightLineMeters(prev, coords) : Infinity;

      if (!force) {
        if (sinceLast < TRACKING_CONFIG.MIN_SEND_INTERVAL_MS) return;
        if (moved < TRACKING_CONFIG.MIN_MOVEMENT_METERS && sinceLast < TRACKING_CONFIG.MAX_SILENT_INTERVAL_MS) {
          return;
        }
      }

      lastSentTimeRef.current = now;
      lastSentCoordsRef.current = coords;
      setLastSendAt(now);

      const timestamp = new Date(now).toISOString();

      // One truck can carry several shipments; each gets the same fix.
      for (const shipmentId of shipmentIdsKey.split(",")) {
        // 1) Realtime socket emit (best-effort, fire and forget).
        if (socket?.connected) {
          updateShipmentLocation(shipmentId, [coords.lat, coords.lng], timestamp);
        }

        // 2) Authoritative persistence over REST. Skipped while offline: the
        //    next fix after reconnecting is sent as usual.
        if (navigator.onLine) {
          try {
            await axiosAuth.patch(`/api/v1/shipments/${shipmentId}/location`, {
              latitude: coords.lat,
              longitude: coords.lng,
            });
            setError(null);
          } catch (err) {
            setError(apiErrorMessage(err));
          }
        }
      }
    },
    [axiosAuth, shipmentIdsKey, socket, updateShipmentLocation],
  );

  useEffect(() => {
    if (!shouldTrack) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      lastSentCoordsRef.current = null;
      lastSentTimeRef.current = 0;
      return;
    }

    if (watchIdRef.current != null) return;

    const onPosition = (pos: GeolocationPosition) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLastFixAt(Date.now());
      setLastCoords(coords);
      // First fix of the session is force-sent.
      const force = lastSentCoordsRef.current == null;
      void sendCoordinates(coords, force);
    };

    const onError = (err: GeolocationPositionError) => {
      setError(err.message);
      if (err.code === err.PERMISSION_DENIED) {
        setPermission("denied");
      }
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, TRACKING_CONFIG.WATCH_OPTIONS);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [shouldTrack, sendCoordinates]);

  const sendFreshFix = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastFixAt(Date.now());
        setLastCoords(coords);
        void sendCoordinates(coords, true);
      },
      () => {
        /* ignore — watcher will catch up */
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [sendCoordinates]);

  useEffect(() => {
    if (!shouldTrack) return;
    const handle = () => {
      if (document.visibilityState === "visible") sendFreshFix();
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [shouldTrack, sendFreshFix]);

  // ---------- ...and when a shipment joins while already tracking ----------
  // The driver just tapped "Going to pickup" with another shipment on the road:
  // its parties are waiting for the truck, so don't make them wait for the
  // movement / silence throttle. (A first shipment needs nothing: the
  // watcher's first fix is force-sent.)
  const trackedIdsRef = useRef("");
  useEffect(() => {
    if (!shouldTrack) {
      trackedIdsRef.current = "";
      return;
    }
    const before = trackedIdsRef.current ? trackedIdsRef.current.split(",") : [];
    trackedIdsRef.current = shipmentIdsKey;
    const joined = shipmentIdsKey.split(",").some((id) => !before.includes(id));
    if (before.length && joined) sendFreshFix();
  }, [shouldTrack, shipmentIdsKey, sendFreshFix]);

  useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (sessionStatus !== "authenticated" || !isDriver || !hasActiveShipment) {
      setState("idle");
      return;
    }
    if (!prefs.enabled) {
      setState("disabled");
      return;
    }
    if (permission === "denied") {
      setState("denied");
      return;
    }
    if (permission === "prompt" && lastFixAt == null) {
      setState("prompt");
      return;
    }
    setState("active");
  }, [supported, sessionStatus, isDriver, hasActiveShipment, prefs.enabled, permission, lastFixAt]);

  return {
    state,
    prefs,
    permission,
    lastFixAt,
    lastSendAt,
    lastCoords,
    online,
    socketConnected,
    hasActiveShipment,
    activeShipments,
    error,
    setEnabled,
  };
}
