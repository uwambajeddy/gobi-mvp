import statusCodes from "../utils/statusCodes";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { recordShipmentLocation } from "../services/shipmentLocation.service";

const { ok } = statusCodes;

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

export const updateShipmentLocation = catchAsync(async (req, res) => {
  const { latitude, longitude } = req.body;

  await recordShipmentLocation({ shipment: req.shipment, latitude, longitude });

  return successResponse(res, ok, { message: "Location updated" });
});
