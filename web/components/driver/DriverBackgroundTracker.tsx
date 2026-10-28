"use client";

import { createContext, useContext } from "react";
import { useDriverBackgroundTracker, type DriverTrackerStatus } from "@/hooks/useDriverBackgroundTracker";

const DriverTrackerContext = createContext<DriverTrackerStatus | null>(null);

/**
 * Single mount point that boots the driver location tracker, once for the
 * whole dashboard (AppShell), and shares its status with the top bar's
 * location chip and the driver's trip card.
 *
 * For anyone who isn't a driver with a shipment on the road the tracker stays
 * idle (no position watcher), so staff are never asked for location permission.
 */
export function DriverTrackerProvider({ children }: { children: React.ReactNode }) {
  const status = useDriverBackgroundTracker();
  return <DriverTrackerContext.Provider value={status}>{children}</DriverTrackerContext.Provider>;
}

/** The tracker's status, or null outside the dashboard shell. */
export const useDriverTracker = () => useContext(DriverTrackerContext);

/** True while the tracker has a shipment to share the location for. */
export const isSharingRelevant = (status: DriverTrackerStatus | null): status is DriverTrackerStatus =>
  Boolean(status && status.state !== "idle" && status.hasActiveShipment);
