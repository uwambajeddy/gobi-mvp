/**
 * Google Maps Platform helpers.
 *
 * Gobi stores places as free text (origin, destination, milestone location),
 * so the map resolves them on the fly:
 *  - Places API (New) text search turns text into coordinates + country;
 *  - Routes API returns the planned driving route between two points.
 * Both are called from the browser with the public key; restrict that key by
 * HTTP referrer in Google Cloud. Coordinates are cached locally for at most
 * 30 days (the limit Google's terms allow); routes are kept in memory only.
 */

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
/** A Map ID enables Advanced Markers; DEMO_MAP_ID works for development. */
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
export const mapsEnabled = GOOGLE_MAPS_API_KEY.length > 0;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPlace extends LatLng {
  query: string;
  formattedAddress: string;
  countryCode?: string;
  countryName?: string;
}

export interface PlannedRoute {
  distanceMeters: number;
  durationSeconds: number;
  path: LatLng[];
}

export class PlaceNotFoundError extends Error {
  constructor(public query: string) {
    super(`Couldn't place "${query}" on the map.`);
  }
}

/* ------------------------------------------------------------------ */
/* Local cache for coordinates (30 days max)                            */
/* ------------------------------------------------------------------ */

const CACHE_PREFIX = "gobi.place.v1:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const cacheKey = (query: string, bias?: Bounds) =>
  `${CACHE_PREFIX}${query.trim().toLowerCase()}${bias ? `@${bias.south.toFixed(1)},${bias.west.toFixed(1)}` : ""}`;

const readCache = (key: string): GeoPlace | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const { at, place } = JSON.parse(raw) as { at: number; place: GeoPlace };
    if (Date.now() - at > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return place;
  } catch {
    return null;
  }
};

const writeCache = (key: string, place: GeoPlace) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), place }));
  } catch {
    /* storage full or unavailable: just skip caching */
  }
};

/* ------------------------------------------------------------------ */
/* Places API (New): text -> coordinates                                */
/* ------------------------------------------------------------------ */

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Resolve free text to a place. `bias` nudges ambiguous names (e.g. a
 * border post) towards the shipment's corridor without excluding others.
 */
export async function searchPlace(query: string, bias?: Bounds): Promise<GeoPlace> {
  const key = cacheKey(query, bias);
  const cached = readCache(key);
  if (cached) return cached;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "places.location,places.formattedAddress,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
      ...(bias && {
        locationBias: {
          rectangle: {
            low: { latitude: bias.south, longitude: bias.west },
            high: { latitude: bias.north, longitude: bias.east },
          },
        },
      }),
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message ?? "Places lookup failed.");

  const found = json.places?.[0];
  if (!found?.location) throw new PlaceNotFoundError(query);

  const country = (found.addressComponents ?? []).find((c: { types: string[] }) =>
    c.types.includes("country"),
  );
  const place: GeoPlace = {
    query,
    lat: found.location.latitude,
    lng: found.location.longitude,
    formattedAddress: found.formattedAddress ?? query,
    countryCode: country?.shortText,
    countryName: country?.longText,
  };
  writeCache(key, place);
  return place;
}

/* ------------------------------------------------------------------ */
/* Routes API: planned driving route                                    */
/* ------------------------------------------------------------------ */

/** Returns null when Google has no driving route between the points. */
export async function computeRoute(origin: LatLng, destination: LatLng): Promise<PlannedRoute | null> {
  const toWaypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineQuality: "OVERVIEW",
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message ?? "Route lookup failed.");

  const route = json.routes?.[0];
  if (!route?.polyline?.encodedPolyline) return null;

  return {
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0,
    path: decodePolyline(route.polyline.encodedPolyline),
  };
}

/* ------------------------------------------------------------------ */
/* Geometry and formatting                                              */
/* ------------------------------------------------------------------ */

/** Google's encoded polyline algorithm (precision 5). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Great-circle distance, used when no driving route is available. */
export function straightLineMeters(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rectangle around the given points, padded so nearby places still match. */
export function corridorBounds(points: LatLng[], padDegrees = 1.5): Bounds | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    south: Math.max(-90, Math.min(...lats) - padDegrees),
    north: Math.min(90, Math.max(...lats) + padDegrees),
    west: Math.max(-180, Math.min(...lngs) - padDegrees),
    east: Math.min(180, Math.max(...lngs) + padDegrees),
  };
}

export const formatDistance = (meters: number) =>
  meters >= 1000 ? `${Math.round(meters / 1000).toLocaleString()} km` : `${Math.round(meters)} m`;

export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};
