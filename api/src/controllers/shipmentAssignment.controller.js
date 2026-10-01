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
import { getShipmentWithContext } from "../services/shipmentAccess.service";
import db from "../database/models";

const { ok, badRequest, notFound, forbidden } = statusCodes;
const { shipment_documents, shipment_packages, vehicles, users, driver_profiles, organization_members } = db;

/** Loads everything both gates need for a proposed vehicle + driver pairing. */
const evaluateGates = async (shipment, vehicleId, driverId) => {
  const [documents, packages, vehicle, driver] = await Promise.all([
    shipment_documents.findAll({ where: { shipmentId: shipment.id } }),
    shipment_packages.findAll({ where: { shipmentId: shipment.id } }),
    vehicleId ? vehicles.findByPk(vehicleId) : null,
    driverId
      ? users.findByPk(driverId, {
          include: [{ model: driver_profiles, as: "driverProfile" }],
        })
      : null,
  ]);

  const cargoKg = computeCargoWeightKg(packages);
  const documentGate = evaluateDocumentGate(documents);
  const complianceGate = evaluateComplianceGate({
    driverProfile: driver?.driverProfile,
    vehicle,
    cargoKg,
    isCrossBorder: shipment.isCrossBorder,
  });

  return { documentGate, complianceGate, vehicle, driver, cargoKg };
};

/** The vehicle and driver must belong to the carrier organization. */
const validatePairing = async (shipment, vehicle, driver) => {
  if (!vehicle) return "Vehicle not found.";
  if (vehicle.organizationId !== shipment.transportOrgId) {
    return "The selected vehicle does not belong to the assigned carrier.";
  }
  if (!driver) return "Driver not found.";

  const driverMembership = await organization_members.findOne({
    where: {
      userId: driver.id,
      organizationId: shipment.transportOrgId,
      role: "driver",
      active: true,
    },
  });
  if (!driverMembership) {
    return "The selected driver is not a driver member of the assigned carrier.";
  }
  return null;
};

/**
 * GET /api/v1/shipments/:id/assignment-preview?vehicleId=&driverId=
 * Live gate evaluation for the assignment panel.
 */
export const previewAssignment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isCarrierCoordinator && !ctx.isAdmin) {
    return next(
      new AppError("Only the carrier's coordinators can prepare assignments.", forbidden),
    );
  }

  const { documentGate, complianceGate, cargoKg } = await evaluateGates(
    shipment,
    req.query.vehicleId,
    req.query.driverId,
  );

  return successResponse(res, ok, { documentGate, complianceGate, cargoKg });
});

/**
 * POST /api/v1/shipments/:id/assign: assign vehicle + driver.
 * Both gates must pass, or be explicitly overridden with an audited reason.
 */
export const assignExecution = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isCarrierCoordinator) {
    return next(
      new AppError("Only the carrier's coordinators can assign vehicle and driver.", forbidden),
    );
  }
  if (!["awaiting_documents", "documents_complete"].includes(shipment.status)) {
    return next(
      new AppError("Vehicle and driver can only be assigned during the documents phase.", badRequest),
    );
  }

  const {
    vehicleId,
    driverId,
    overrideDocumentGate,
    overrideComplianceGate,
    overrideReason,
  } = req.body;

  const { documentGate, complianceGate, vehicle, driver, cargoKg } = await evaluateGates(
    shipment,
    vehicleId,
    driverId,
  );

  const pairingError = await validatePairing(shipment, vehicle, driver);
  if (pairingError) return next(new AppError(pairingError, badRequest));

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
