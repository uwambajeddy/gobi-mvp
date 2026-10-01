import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse, deleteResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import db from "../database/models";

const { ok, created, notFound, conflict } = statusCodes;
const { vehicles } = db;

/**
 * POST /api/v1/vehicles: register a vehicle in the active transport org's fleet.
 */
export const createVehicle = catchAsync(async (req, res, next) => {
  const { plateNumber } = req.body;

  const existing = await vehicles.findOne({ where: { plateNumber } });
  if (existing) {
    return next(new AppError("A vehicle with this plate number already exists.", conflict));
  }

  const vehicle = await vehicles.create({
    ...req.body,
    organizationId: req.activeMembership.organizationId,
  });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.CREATE_VEHICLE,
    entityType: "vehicles",
    entityId: vehicle.id,
    description: `Registered vehicle ${vehicle.plateNumber} (${vehicle.model})`,
  });

  return successResponse(res, created, { vehicle });
});

/**
 * GET /api/v1/vehicles: the active transport org's fleet.
 */
export const listVehicles = catchAsync(async (req, res) => {
  const fleet = await vehicles.findAll({
    where: { organizationId: req.activeMembership.organizationId },
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { vehicles: fleet });
});

/** Loads a vehicle owned by the active org or 404s. */
const findOwnVehicle = async (req, next) => {
  const vehicle = await vehicles.findOne({
    where: { id: req.params.id, organizationId: req.activeMembership.organizationId },
  });

  if (!vehicle) {
    next(new AppError("Vehicle not found.", notFound));
    return null;
  }
  return vehicle;
};

/**
 * GET /api/v1/vehicles/:id
 */
export const getVehicle = catchAsync(async (req, res, next) => {
  const vehicle = await findOwnVehicle(req, next);
  if (!vehicle) return;

  return successResponse(res, ok, { vehicle });
});

/**
 * PATCH /api/v1/vehicles/:id
 */
export const updateVehicle = catchAsync(async (req, res, next) => {
  const vehicle = await findOwnVehicle(req, next);
  if (!vehicle) return;

  if (req.body.plateNumber && req.body.plateNumber !== vehicle.plateNumber) {
    const duplicate = await vehicles.findOne({ where: { plateNumber: req.body.plateNumber } });
    if (duplicate) {
      return next(new AppError("A vehicle with this plate number already exists.", conflict));
    }
  }

  await vehicle.update(req.body);

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.UPDATE_VEHICLE,
    entityType: "vehicles",
    entityId: vehicle.id,
    description: `Updated vehicle ${vehicle.plateNumber}`,
    metadata: { fields: Object.keys(req.body) },
  });

  return successResponse(res, ok, { vehicle });
});

/**
 * DELETE /api/v1/vehicles/:id
 */
export const deleteVehicle = catchAsync(async (req, res, next) => {
  const vehicle = await findOwnVehicle(req, next);
  if (!vehicle) return;

  await vehicle.destroy();

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.DELETE_VEHICLE,
    entityType: "vehicles",
    entityId: Number(req.params.id),
    description: `Deleted vehicle ${vehicle.plateNumber}`,
  });

  return deleteResponse(res, "Vehicle deleted successfully.");
});
