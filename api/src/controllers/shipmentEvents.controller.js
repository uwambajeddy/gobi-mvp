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

// Routes run `authorizeShipment(action)` first, so handlers receive `req.shipment`
// and `req.access`; recording is limited to OPERATIONAL_STATUSES there.
const { ok, created, badRequest } = statusCodes;
const { shipment_events, users } = db;

const actorInclude = [
  { model: users, as: "actor", attributes: ["id", "firstName", "lastName"] },
];

/**
 * GET /api/v1/shipments/:id/events: the operational timeline (newest first).
 * Amounts on quote and payment events are left out for the assigned driver.
 */
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

/**
 * POST /api/v1/shipments/:id/events: record a manual operational milestone.
 * The structured replacement for a WhatsApp message: who, what, when, where,
 * evidence. The driver's progress milestones (DRIVER_MILESTONES: going to
 * pickup, arrived at pickup, picked up, arrived at destination) are the
 * driver's one-tap buttons: only the carrier's coordinators and the assigned
 * driver may record them, each once, and they notify every party.
 */
export const recordEvent = catchAsync(async (req, res, next) => {
  const { shipment, access } = req;
  const { eventType, occurredAt, locationName, notes, metadata } = req.body;

  // Driver progress must come from the carrier and respect the state machine.
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
    // A double tap must not record (and announce) the same step twice.
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
  // "Going to pickup" starts the trip: live tracking runs from here (config/shipmentPolicies).
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
    // Send status change notification (in-app) to every party, and email where a rule exists
    await notifyShipmentStatusChange(eventType, shipment, { actorUserId: req.user.id });
    notifyShipmentEvent(eventType, { shipmentId: shipment.id, actorUserId: req.user.id });

    // Notify every party via socket for real-time update
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
