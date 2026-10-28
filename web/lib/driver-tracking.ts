export const TRACKING_CONFIG = {
  MIN_SEND_INTERVAL_MS: 10_000,
  MAX_SILENT_INTERVAL_MS: 120_000,
  MIN_MOVEMENT_METERS: 20,
  WATCH_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 30_000,
    maximumAge: 0,
  } satisfies PositionOptions,
} as const;

const PREFS_KEY = "gobi.driverTracking.prefs.v1";

export interface DriverTrackingPrefs {
  enabled: boolean;
}

const DEFAULT_PREFS: DriverTrackingPrefs = {
  enabled: true,
};

export function loadDriverTrackingPrefs(): DriverTrackingPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DriverTrackingPrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveDriverTrackingPrefs(patch: Partial<DriverTrackingPrefs>): DriverTrackingPrefs {
  const next = { ...loadDriverTrackingPrefs(), ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}
