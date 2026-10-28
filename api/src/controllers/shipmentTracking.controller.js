import statusCodes from "../utils/statusCodes";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { recordShipmentLocation } from "../services/shipmentLocation.service";

// Routes run `authorizeShipment(action)` first, so handlers receive `req.shipment`:
// any party may view tracking; only the assigned driver may update it, in transit.
const { ok } = statusCodes;

/**
 * GET /api/v1/shipments/:id/tracking: the driver's latest position and the
 * recent trail. The web app polls it as a fallback to the live socket updates.
 */
export const getShipmentTracking = catchAsync(async (req, res) => {
  const { shipment } = req;

  const tracking = {
    id: shipment.id,
    status: shipment.status,
    currentLocation: shipment.currentLocation,
    lastLocationUpdate: shipment.lastLocationUpdate,
    trackingHistory: shipment.trackings || [],
  };

  return successResponse(res, ok, { tracking });
});

/**
 * PATCH /api/v1/shipments/:id/location: the assigned driver's browser saves
 * its current position while the shipment is in transit.
 */
export const updateShipmentLocation = catchAsync(async (req, res) => {
  const { latitude, longitude } = req.body;

  await recordShipmentLocation({ shipment: req.shipment, latitude, longitude });

  return successResponse(res, ok, { message: "Location updated" });
});
