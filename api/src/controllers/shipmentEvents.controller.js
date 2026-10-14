import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { checkShipmentPolicy } from "../services/shipmentAccess.service";
import { presentEvents } from "../services/shipmentVisibility.service";
import { EVENT_STATUS_EFFECTS } from "../config/shipmentEvents";
import db from "../database/models";

const { ok, created, badRequest } = statusCodes;
const { shipment_events, users } = db;

const actorInclude = [
  { model: users, as: "actor", attributes: ["id", "firstName", "lastName"] },
];

export const listEvents = catchAsync(async (req, res) => {
  const { shipment, access } = req;

  const events = await shipment_events.findAll({
    where: { shipmentId: shipment.id },
    include: actorInclude,
    order: [
      ["occurredAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  return successResponse(res, ok, { events: presentEvents(events, shipment, access) });
});

export const recordEvent = catchAsync(async (req, res, next) => {
  const { shipment, access } = req;
  const { eventType, occurredAt, locationName, notes, metadata } = req.body;

  // Lifecycle-advancing events must come from the carrier and respect the state machine.
  const effect = EVENT_STATUS_EFFECTS[eventType];
  if (effect) {
    const denied = checkShipmentPolicy("recordStatusMilestone", shipment, access);
    if (denied) return next(denied);
  }
  if (effect && !effect.from.includes(shipment.status)) {
    return next(
      new AppError(
        `"${eventType}" cannot be recorded while the shipment is ${shipment.status}.`,
        badRequest,
      ),
    );
  }

  const event = await shipment_events.create({
    shipmentId: shipment.id,
    eventType,
    actorUserId: req.user.id,
    occurredAt: occurredAt || new Date(),
    locationName,
    notes,
    metadata,
    source: "manual",
  });

  if (effect) {
    await shipment.update({ status: effect.to });
  }

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.RECORD_SHIPMENT_EVENT,
    entityType: "shipment_events",
    entityId: event.id,
    description: `Recorded "${eventType}" on ${shipment.reference}${locationName ? ` at ${locationName}` : ""}`,
    metadata: { eventType, shipmentId: shipment.id, statusAfter: shipment.status },
  });

  const withActor = await shipment_events.findByPk(event.id, { include: actorInclude });
  return successResponse(res, created, { event: withActor, shipmentStatus: shipment.status });
});
