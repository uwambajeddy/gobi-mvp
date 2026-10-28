import db from "../database/models";

const { shipments } = db;

/** Tracking points kept per shipment, to avoid database bloat. */
const MAX_TRACKING_POINTS = 100;

/**
 * Record a new location point for a shipment and persist it: the latest
 * position (`currentLocation`) plus a short history (`trackings`).
 *
 * Called by the assigned driver's REST endpoint (`updateShipmentLocation`).
 * The same fix also travels live over the `newCoordinates` socket event
 * (utils/socket.io.js); this call is the authoritative, saved copy.
 *
 * @param {object} opts
 * @param {object} opts.shipment  shipments instance (needs `id`, `trackings`)
 * @param {number|string} opts.latitude
 * @param {number|string} opts.longitude
 * @returns {Promise<{ newTracking: { lat: number, lng: number, timestamp: string } }>}
 */
export const recordShipmentLocation = async ({ shipment, latitude, longitude }) => {
  const newTracking = {
    lat: parseFloat(latitude),
    lng: parseFloat(longitude),
    timestamp: new Date().toISOString(),
  };
  const currentTrackings = shipment.trackings || [];
  currentTrackings.push(newTracking);

  // `silent`: a location ping is not an edit, so updatedAt is left alone.
  await shipments.update(
    {
      trackings: currentTrackings.slice(-MAX_TRACKING_POINTS),
      currentLocation: { lat: newTracking.lat, lng: newTracking.lng },
      lastLocationUpdate: new Date(),
    },
    { where: { id: shipment.id }, silent: true },
  );

  return { newTracking };
};
