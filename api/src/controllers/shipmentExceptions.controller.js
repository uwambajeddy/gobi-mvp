import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import db from "../database/models";

// Routes run `authorizeShipment(action)` first: handlers receive `req.shipment`
// and, on /exceptions/:exceptionId routes, `req.exception`.
const { ok, created, badRequest } = statusCodes;
const { shipment_exceptions, users } = db;

const peopleInclude = [
  { model: users, as: "openedBy", attributes: ["id", "firstName", "lastName"] },
  { model: users, as: "resolvedBy", attributes: ["id", "firstName", "lastName"] },
];

/**
 * GET /api/v1/shipments/:id/exceptions
 */
export const listExceptions = catchAsync(async (req, res) => {
  const { shipment } = req;

  const exceptions = await shipment_exceptions.findAll({
    where: { shipmentId: shipment.id },
    include: peopleInclude,
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { exceptions });
});

/**
 * POST /api/v1/shipments/:id/exceptions: any party (including the driver)
 * can raise an incident; open exceptions block shipment completion.
 */
export const openException = catchAsync(async (req, res) => {
  const { shipment } = req;
  const { type, severity, notes } = req.body;

  const exception = await shipment_exceptions.create({
    shipmentId: shipment.id,
    type,
    severity,
    notes,
    openedByUserId: req.user.id,
  });

  await recordSystemEvent(shipment.id, "exception_opened", {
    req,
    notes: `${type.replace(/_/g, " ")} (${severity})`,
    metadata: { exceptionId: exception.id, type, severity },
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.OPEN_EXCEPTION,
    entityType: "shipment_exceptions",
    entityId: exception.id,
    description: `Opened ${severity} ${type} exception on ${shipment.reference}`,
    metadata: { type, severity },
  });

  const withPeople = await shipment_exceptions.findByPk(exception.id, { include: peopleInclude });
  return successResponse(res, created, { exception: withPeople });
});

/**
 * PATCH /api/v1/shipments/exceptions/:exceptionId/resolve: carrier coordinator
 * resolves with resolution notes.
 */
export const resolveException = catchAsync(async (req, res, next) => {
  const { shipment, exception } = req;

  if (exception.status === "resolved") {
    return next(new AppError("This exception is already resolved.", badRequest));
  }

  await exception.update({
    status: "resolved",
    resolutionNotes: req.body.resolutionNotes,
    resolvedByUserId: req.user.id,
    resolvedAt: new Date(),
  });

  await recordSystemEvent(shipment.id, "exception_resolved", {
    req,
    notes: req.body.resolutionNotes,
    metadata: { exceptionId: exception.id, type: exception.type },
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.RESOLVE_EXCEPTION,
    entityType: "shipment_exceptions",
    entityId: exception.id,
    description: `Resolved ${exception.type} exception on ${shipment.reference}`,
    metadata: { type: exception.type },
  });

  return successResponse(res, ok, { exception });
});
