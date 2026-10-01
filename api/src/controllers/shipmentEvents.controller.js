import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { getShipmentWithContext } from "../services/shipmentAccess.service";
import { EVENT_STATUS_EFFECTS } from "../config/shipmentEvents";
import db from "../database/models";

const { ok, created, badRequest, notFound, forbidden } = statusCodes;
const { shipment_events, users } = db;

const actorInclude = [
  { model: users, as: "actor", attributes: ["id", "firstName", "lastName"] },
];

/** Window in which manual operational milestones may be recorded. */
const OPERATIONAL_STATUSES = ["execution_assigned", "in_transit", "arrived", "delivered"];

/**
 * GET /api/v1/shipments/:id/events: the operational timeline (newest first).
 */
export const listEvents = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isParty) {
    return next(new AppError("You are not a party to this shipment.", forbidden));
  }

  const events = await shipment_events.findAll({
    where: { shipmentId: shipment.id },
    include: actorInclude,
    order: [
      ["occurredAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  return successResponse(res, ok, { events });
});

/**
 * POST /api/v1/shipments/:id/events: record a manual operational milestone.
 * The structured replacement for a WhatsApp message: who, what, when, where,
 * evidence. Events with a lifecycle effect (picked_up, arrived_destination)
 * also advance the shipment status.
 */
export const recordEvent = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipper && !ctx.isCarrier && !ctx.isAgent && !ctx.isAssignedDriver) {
    return next(new AppError("Only shipment parties can record events.", forbidden));
  }
  if (!OPERATIONAL_STATUSES.includes(shipment.status)) {
    return next(
      new AppError(
        "Operational events can only be recorded once a vehicle and driver are assigned.",
        badRequest,
      ),
    );
  }

  const { eventType, occurredAt, locationName, notes, metadata } = req.body;

  // Lifecycle-advancing events must respect the state machine.
  const effect = EVENT_STATUS_EFFECTS[eventType];
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
