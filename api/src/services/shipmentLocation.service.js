import db from "../database/models";

const { shipments } = db;

/** Tracking points kept per shipment, to avoid database bloat. */
const MAX_TRACKING_POINTS = 100;

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
