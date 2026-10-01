import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { getShipmentWithContext } from "../services/shipmentAccess.service";
import db from "../database/models";

const { ok, created, notFound, forbidden, badRequest } = statusCodes;
const { shipment_exceptions, users } = db;

const peopleInclude = [
  { model: users, as: "openedBy", attributes: ["id", "firstName", "lastName"] },
  { model: users, as: "resolvedBy", attributes: ["id", "firstName", "lastName"] },
];

/**
 * GET /api/v1/shipments/:id/exceptions
 */
export const listExceptions = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isParty) {
    return next(new AppError("You are not a party to this shipment.", forbidden));
  }

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
export const openException = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipper && !ctx.isCarrier && !ctx.isAgent && !ctx.isAssignedDriver) {
    return next(new AppError("Only shipment parties can open exceptions.", forbidden));
  }

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
  const exception = await shipment_exceptions.findByPk(req.params.exceptionId);
  if (!exception) return next(new AppError("Exception not found.", notFound));

  const { shipment, ctx } = await getShipmentWithContext(exception.shipmentId, req, { include: [] });
  if (!ctx.isCarrierCoordinator && !ctx.isAdmin) {
    return next(
      new AppError("Only the carrier's coordinators can resolve exceptions.", forbidden),
    );
  }
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
