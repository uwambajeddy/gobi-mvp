import db from "../database/models";

const { shipments } = db;

const MAX_TRACKING_POINTS = 100;

export const recordShipmentLocation = async ({ shipment, latitude, longitude }) => {
  const newTracking = {
    lat: parseFloat(latitude),
    lng: parseFloat(longitude),
    timestamp: new Date().toISOString(),
  };
  const currentTrackings = shipment.trackings || [];
  currentTrackings.push(newTracking);

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
