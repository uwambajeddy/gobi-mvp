import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { checkShipmentPolicy } from "../services/shipmentAccess.service";
import { presentEvents } from "../services/shipmentVisibility.service";
import { notifyShipmentEvent } from "../services/notifications.service";
import { notifyShipmentStatusChange } from "../utils/shipmentStatusNotifications";
import { emitToShipmentParties } from "../utils/socket.io";
import { DRIVER_MILESTONES, EVENT_LABELS } from "../config/shipmentEvents";
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

  const milestone = DRIVER_MILESTONES[eventType];
  if (milestone) {
    const denied = checkShipmentPolicy("recordStatusMilestone", shipment, access);
    if (denied) return next(denied);

    if (!milestone.from.includes(shipment.status)) {
      return next(
        new AppError(
          `"${eventType}" cannot be recorded while the shipment is ${shipment.status}.`,
          badRequest,
        ),
      );
    }
    const alreadyRecorded = await shipment_events.count({ where: { shipmentId: shipment.id, eventType } });
    if (alreadyRecorded) {
      return next(new AppError(`"${EVENT_LABELS[eventType]}" has already been recorded.`, badRequest));
    }
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

  if (milestone?.to) {
    await shipment.update({ status: milestone.to });
  }
  if (eventType === "en_route_to_pickup") {
    await shipment.update({ startTime: event.occurredAt });
  }

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.RECORD_SHIPMENT_EVENT,
    entityType: "shipment_events",
    entityId: event.id,
    description: `Recorded "${eventType}" on ${shipment.reference}${locationName ? ` at ${locationName}` : ""}`,
    metadata: { eventType, shipmentId: shipment.id, statusAfter: shipment.status },
  });

  if (milestone) {
    await notifyShipmentStatusChange(eventType, shipment, { actorUserId: req.user.id });
    notifyShipmentEvent(eventType, { shipmentId: shipment.id, actorUserId: req.user.id });

    await emitToShipmentParties(shipment, "shipmentStatusUpdate", {
      shipmentId: shipment.id,
      status: shipment.status,
      eventType,
      actorUserId: req.user.id,
      message: `${shipment.reference}: ${EVENT_LABELS[eventType]}`,
    });
  }

  const withActor = await shipment_events.findByPk(event.id, { include: actorInclude });
  return successResponse(res, created, { event: withActor, shipmentStatus: shipment.status });
});
