import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { notifyShipmentStatusChange } from "../utils/shipmentStatusNotifications";
import { emitToShipmentParties } from "../utils/socket.io";
import { evaluateDocumentGate } from "../services/documentGate.service";
import {
  evaluateComplianceGate,
  computeCargoWeightKg,
} from "../services/complianceGate.service";
import { isValidId } from "../middlewares/validateId";
import db from "../database/models";

const { ok, badRequest } = statusCodes;
const { shipment_documents, shipment_packages, vehicles, users, driver_profiles, organization_members } = db;

const VEHICLE_NOT_IN_FLEET = "The selected vehicle is not in the assigned carrier's fleet.";
const NOT_A_CARRIER_DRIVER = "The selected driver is not a driver member of the assigned carrier.";

const toId = (value) => (isValidId(value) ? Number(value) : null);

const findCarrierVehicle = (shipment, vehicleId) =>
  toId(vehicleId) && shipment.transportOrgId
    ? vehicles.findOne({ where: { id: toId(vehicleId), organizationId: shipment.transportOrgId } })
    : null;

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

  await notifyShipmentStatusChange("execution_assigned", shipment, { actorUserId: req.user.id });
  await emitToShipmentParties(shipment, "shipmentStatusUpdate", {
    shipmentId: shipment.id,
    status: shipment.status,
    eventType: "execution_assigned",
    actorUserId: req.user.id,
    message: `${shipment.reference}: Vehicle and driver assigned`,
  });

  return successResponse(res, ok, {
    shipment,
    documentGate,
    complianceGate,
    overridden: { documentGateOverridden, complianceGateOverridden },
  });
});
