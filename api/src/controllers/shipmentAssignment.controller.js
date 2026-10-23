import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { evaluateDocumentGate } from "../services/documentGate.service";
import {
  evaluateComplianceGate,
  computeCargoWeightKg,
} from "../services/complianceGate.service";
import { isValidId } from "../middlewares/validateId";
import db from "../database/models";

// Routes run `authorizeShipment(action)` first, so handlers receive `req.shipment`.
const { ok, badRequest } = statusCodes;
const { shipment_documents, shipment_packages, vehicles, users, driver_profiles, organization_members } = db;

// A selection outside the shipment's carrier gets the same answer as an id
// that does not exist, so neither route reveals another carrier's fleet.
const VEHICLE_NOT_IN_FLEET = "The selected vehicle is not in the assigned carrier's fleet.";
const NOT_A_CARRIER_DRIVER = "The selected driver is not a driver member of the assigned carrier.";

/** A valid row id, or null for anything else (malformed ids match nothing). */
const toId = (value) => (isValidId(value) ? Number(value) : null);

/** The vehicle, if it is in the shipment carrier's fleet. */
const findCarrierVehicle = (shipment, vehicleId) =>
  toId(vehicleId) && shipment.transportOrgId
    ? vehicles.findOne({ where: { id: toId(vehicleId), organizationId: shipment.transportOrgId } })
    : null;

/** The user with their driver profile, if they are an active driver of the shipment's carrier. */
const findCarrierDriver = async (shipment, driverId) => {
  if (!toId(driverId) || !shipment.transportOrgId) return null;

  const membership = await organization_members.findOne({
    where: {
      userId: toId(driverId),
      organizationId: shipment.transportOrgId,
      role: "driver",
      active: true,
    },
  });
  if (!membership) return null;

  return users.findByPk(toId(driverId), {
    include: [{ model: driver_profiles, as: "driverProfile" }],
  });
};

/** Evaluates both gates for a vehicle + driver already scoped to the carrier. */
const evaluateGates = async (shipment, vehicle, driver) => {
  const [documents, packages] = await Promise.all([
    shipment_documents.findAll({ where: { shipmentId: shipment.id } }),
    shipment_packages.findAll({ where: { shipmentId: shipment.id } }),
  ]);

  const cargoKg = computeCargoWeightKg(packages);
  const documentGate = evaluateDocumentGate(documents);
  const complianceGate = evaluateComplianceGate({
    driverProfile: driver?.driverProfile,
    vehicle,
    cargoKg,
    isCrossBorder: shipment.isCrossBorder,
  });

  return { documentGate, complianceGate, cargoKg };
};

/**
 * GET /api/v1/shipments/:id/assignment-preview?vehicleId=&driverId=
 * Live gate evaluation for the assignment panel. Only the shipment carrier's
 * own vehicles and drivers can be previewed.
 */
export const previewAssignment = catchAsync(async (req, res, next) => {
  const { shipment } = req;
  const { vehicleId, driverId } = req.query;

  const [vehicle, driver] = await Promise.all([
    findCarrierVehicle(shipment, vehicleId),
    findCarrierDriver(shipment, driverId),
  ]);
  if (vehicleId !== undefined && !vehicle) return next(new AppError(VEHICLE_NOT_IN_FLEET, badRequest));
  if (driverId !== undefined && !driver) return next(new AppError(NOT_A_CARRIER_DRIVER, badRequest));

  const { documentGate, complianceGate, cargoKg } = await evaluateGates(shipment, vehicle, driver);

  return successResponse(res, ok, { documentGate, complianceGate, cargoKg });
});

/**
 * POST /api/v1/shipments/:id/assign: assign vehicle + driver.
 * Both gates must pass, or be explicitly overridden with an audited reason.
 */
export const assignExecution = catchAsync(async (req, res, next) => {
  const { shipment } = req;

  const {
    vehicleId,
    driverId,
    overrideDocumentGate,
    overrideComplianceGate,
    overrideReason,
  } = req.body;

  const [vehicle, driver] = await Promise.all([
    findCarrierVehicle(shipment, vehicleId),
    findCarrierDriver(shipment, driverId),
  ]);
  if (!vehicle) return next(new AppError(VEHICLE_NOT_IN_FLEET, badRequest));
  if (!driver) return next(new AppError(NOT_A_CARRIER_DRIVER, badRequest));

  const { documentGate, complianceGate, cargoKg } = await evaluateGates(shipment, vehicle, driver);

  // Gate enforcement (overridable, but always audited)
  if (!documentGate.passed && !overrideDocumentGate) {
    return next(
      new AppError(
        `Document gate failed: ${documentGate.missing.map((d) => d.label).join(", ")} missing or invalid.`,
        badRequest,
      ),
    );
  }
  if (!complianceGate.passed && !overrideComplianceGate) {
    return next(
      new AppError(
        `Compliance gate failed: ${complianceGate.failures.map((f) => f.message).join(" ")}`,
        badRequest,
      ),
    );
  }

  const documentGateOverridden = !documentGate.passed && overrideDocumentGate;
  const complianceGateOverridden = !complianceGate.passed && overrideComplianceGate;

  await shipment.update({
    assignedVehicleId: vehicle.id,
    assignedDriverId: driver.id,
    status: "execution_assigned",
  });

  await recordSystemEvent(shipment.id, "execution_assigned", {
    req,
    notes: `${driver.firstName} ${driver.lastName} with ${vehicle.plateNumber}`,
    metadata: { vehicleId: vehicle.id, driverId: driver.id, cargoKg },
  });

  if (documentGateOverridden || complianceGateOverridden) {
    await recordSystemEvent(shipment.id, "gate_overridden", {
      req,
      notes: overrideReason,
      metadata: {
        documentGateOverridden,
        complianceGateOverridden,
        missingDocsAtDispatch: documentGate.missing,
        complianceFailuresAtDispatch: complianceGate.failures,
      },
    });
  }

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ASSIGN_EXECUTION,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Assigned ${driver.firstName} ${driver.lastName} + ${vehicle.plateNumber} to ${shipment.reference}`,
    metadata: {
      vehicleId: vehicle.id,
      driverId: driver.id,
      cargoKg,
      documentGateOverridden,
      missingDocsAtDispatch: documentGate.missing,
      complianceGateOverridden,
      complianceFailuresAtDispatch: complianceGate.failures,
      overrideReason: overrideReason || null,
      warnings: complianceGate.warnings,
    },
  });

  return successResponse(res, ok, {
    shipment,
    documentGate,
    complianceGate,
    overridden: { documentGateOverridden, complianceGateOverridden },
  });
});
