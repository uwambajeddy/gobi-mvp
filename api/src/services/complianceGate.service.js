/**
 * Compliance Gate, adapted from the commercial dispatchGate.service.
 *
 * Evaluated before a vehicle + driver can be assigned to a shipment.
 * Hard failures block the assignment (unless explicitly overridden with an
 * audited reason); warnings never block.
 */

/** EAC corridor hard limit; beyond this the load must be split. */
export const GVW_LIMIT_KG = 56000;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isExpired = (dateOnly) => dateOnly && new Date(dateOnly) < startOfToday();

/** Total cargo weight = Σ (package weight × quantity). */
export const computeCargoWeightKg = (packages = []) =>
  packages.reduce(
    (sum, pkg) => sum + (pkg.weightKg || 0) * (pkg.quantity || 1),
    0,
  );

/**
 * @returns {{passed: boolean, failures: Array, warnings: Array, cargoKg: number}}
 */
export const evaluateComplianceGate = ({
  driverProfile,
  vehicle,
  cargoKg = 0,
  isCrossBorder = false,
}) => {
  const failures = [];
  const warnings = [];

  // Driver checks
  if (!driverProfile || driverProfile.status !== "approved") {
    failures.push({
      code: "driver_not_verified",
      message: "Driver has no approved driver profile.",
    });
  } else {
    if (isExpired(driverProfile.licenceExpiresAt)) {
      failures.push({
        code: "driver_licence_expired",
        message: `Driver licence expired on ${driverProfile.licenceExpiresAt}.`,
      });
    } else if (!driverProfile.licenceExpiresAt) {
      warnings.push({
        code: "driver_licence_expiry_missing",
        message: "Driver licence expiry date is not on file.",
      });
    }
  }

  // Vehicle checks
  if (!vehicle) {
    failures.push({ code: "vehicle_missing", message: "No vehicle selected." });
  } else {
    if (isExpired(vehicle.insuranceExpiresAt)) {
      failures.push({
        code: "vehicle_insurance_expired",
        message: `Vehicle insurance expired on ${vehicle.insuranceExpiresAt}.`,
      });
    } else if (!vehicle.insuranceExpiresAt) {
      warnings.push({
        code: "vehicle_insurance_expiry_missing",
        message: "Vehicle insurance expiry date is not on file.",
      });
    }

    if (isExpired(vehicle.inspectionExpiresAt)) {
      failures.push({
        code: "vehicle_inspection_expired",
        message: `Vehicle inspection expired on ${vehicle.inspectionExpiresAt}.`,
      });
    } else if (!vehicle.inspectionExpiresAt) {
      warnings.push({
        code: "vehicle_inspection_expiry_missing",
        message: "Vehicle inspection expiry date is not on file.",
      });
    }

    if (isCrossBorder) {
      if (isExpired(vehicle.yellowCardExpiresAt)) {
        failures.push({
          code: "vehicle_yellow_card_expired",
          message: `COMESA Yellow Card expired on ${vehicle.yellowCardExpiresAt}.`,
        });
      } else if (!vehicle.yellowCardExpiresAt) {
        warnings.push({
          code: "vehicle_yellow_card_expiry_missing",
          message: "COMESA Yellow Card expiry date is not on file.",
        });
      }
    }

    // Payload checks
    if (vehicle.capacityKg && cargoKg > vehicle.capacityKg) {
      failures.push({
        code: "payload_exceeded",
        message: `Cargo (${cargoKg} kg) exceeds vehicle capacity (${vehicle.capacityKg} kg).`,
      });
    }
  }

  if (cargoKg > GVW_LIMIT_KG) {
    failures.push({
      code: "gvw_exceeded",
      message: `Cargo (${cargoKg} kg) exceeds the EAC ${GVW_LIMIT_KG / 1000} t GVW limit. The load must be split.`,
    });
  }

  return { passed: failures.length === 0, failures, warnings, cargoKg };
};
