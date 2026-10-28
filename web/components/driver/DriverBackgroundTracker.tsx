"use client";

import { createContext, useContext } from "react";
import { useDriverBackgroundTracker, type DriverTrackerStatus } from "@/hooks/useDriverBackgroundTracker";

const DriverTrackerContext = createContext<DriverTrackerStatus | null>(null);

export function DriverTrackerProvider({ children }: { children: React.ReactNode }) {
  const status = useDriverBackgroundTracker();
  return <DriverTrackerContext.Provider value={status}>{children}</DriverTrackerContext.Provider>;
}

export const useDriverTracker = () => useContext(DriverTrackerContext);

export const isSharingRelevant = (status: DriverTrackerStatus | null): status is DriverTrackerStatus =>
  Boolean(status && status.state !== "idle" && status.hasActiveShipment);
