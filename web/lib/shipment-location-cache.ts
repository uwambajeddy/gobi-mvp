export interface CachedShipmentLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

const PREFIX = "gobi.shipmentLocation.v1:";

function key(id: string | number): string {
  return `${PREFIX}${id}`;
}

export function readShipmentLocation(id: string | number | null | undefined): CachedShipmentLocation | null {
  if (id == null || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedShipmentLocation;
    if (
      typeof parsed?.lat === "number" &&
      typeof parsed?.lng === "number" &&
      typeof parsed?.updatedAt === "number"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeShipmentLocation(id: string | number, next: CachedShipmentLocation): CachedShipmentLocation {
  if (typeof window === "undefined") return next;
  const existing = readShipmentLocation(id);
  if (existing && next.updatedAt <= existing.updatedAt) return existing;
  try {
    window.localStorage.setItem(key(id), JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
  return next;
}

export function toEpoch(t: number | string | Date | undefined | null): number {
  if (t == null) return Date.now();
  if (typeof t === "number") return t;
  const d = t instanceof Date ? t : new Date(t);
  const n = d.getTime();
  return Number.isFinite(n) ? n : Date.now();
}
