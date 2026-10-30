import { expect } from "chai";
import {
  GVW_LIMIT_KG,
  computeCargoWeightKg,
  evaluateComplianceGate,
} from "../../src/services/complianceGate.service";

const daysFromToday = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const validDriver = () => ({ status: "approved", licenceExpiresAt: daysFromToday(365) });

const validVehicle = (overrides = {}) => ({
  capacityKg: 30000,
  insuranceExpiresAt: daysFromToday(90),
  inspectionExpiresAt: daysFromToday(90),
  yellowCardExpiresAt: daysFromToday(90),
  ...overrides,
});

const codes = (items) => items.map((item) => item.code);

describe("Unit: compliance gate", () => {
  describe("computeCargoWeightKg", () => {
    it("sums weight × quantity across packages", () => {
      const packages = [
        { weightKg: 100, quantity: 3 },
        { weightKg: 250.5, quantity: 2 },
      ];
      expect(computeCargoWeightKg(packages)).to.equal(801);
    });

    it("treats a missing quantity as 1 and a missing weight as 0", () => {
      expect(computeCargoWeightKg([{ weightKg: 40 }, { quantity: 5 }])).to.equal(40);
    });

    it("returns 0 for no packages", () => {
      expect(computeCargoWeightKg()).to.equal(0);
      expect(computeCargoWeightKg([])).to.equal(0);
    });
  });

  describe("evaluateComplianceGate", () => {
    it("passes a verified driver with a compliant vehicle", () => {
      const result = evaluateComplianceGate({
        driverProfile: validDriver(),
        vehicle: validVehicle(),
        cargoKg: 12000,
        isCrossBorder: true,
      });
      expect(result.passed).to.equal(true);
      expect(result.failures).to.be.empty;
      expect(result.cargoKg).to.equal(12000);
    });

    it("blocks a driver without an approved profile", () => {
      const result = evaluateComplianceGate({
        driverProfile: { status: "pending", licenceExpiresAt: daysFromToday(30) },
        vehicle: validVehicle(),
      });
      expect(result.passed).to.equal(false);
      expect(codes(result.failures)).to.include("driver_not_verified");
    });

    it("blocks an expired licence but accepts one that expires today", () => {
      const expired = evaluateComplianceGate({
        driverProfile: { status: "approved", licenceExpiresAt: daysFromToday(-1) },
        vehicle: validVehicle(),
      });
      expect(codes(expired.failures)).to.include("driver_licence_expired");

      const today = evaluateComplianceGate({
        driverProfile: { status: "approved", licenceExpiresAt: daysFromToday(0) },
        vehicle: validVehicle(),
      });
      expect(codes(today.failures)).to.not.include("driver_licence_expired");
    });

    it("warns, without blocking, when expiry dates are not on file", () => {
      const result = evaluateComplianceGate({
        driverProfile: { status: "approved" },
        vehicle: { capacityKg: 10000 },
        isCrossBorder: true,
      });
      expect(result.passed).to.equal(true);
      expect(codes(result.warnings)).to.have.members([
        "driver_licence_expiry_missing",
        "vehicle_insurance_expiry_missing",
        "vehicle_inspection_expiry_missing",
        "vehicle_yellow_card_expiry_missing",
      ]);
    });

    it("blocks expired insurance and inspection", () => {
      const result = evaluateComplianceGate({
        driverProfile: validDriver(),
        vehicle: validVehicle({
          insuranceExpiresAt: daysFromToday(-10),
          inspectionExpiresAt: daysFromToday(-2),
        }),
      });
      expect(codes(result.failures)).to.include.members([
        "vehicle_insurance_expired",
        "vehicle_inspection_expired",
      ]);
    });

    it("checks the Yellow Card only for cross-border shipments", () => {
      const vehicle = validVehicle({ yellowCardExpiresAt: daysFromToday(-5) });

      const domestic = evaluateComplianceGate({ driverProfile: validDriver(), vehicle });
      expect(domestic.passed).to.equal(true);

      const crossBorder = evaluateComplianceGate({
        driverProfile: validDriver(),
        vehicle,
        isCrossBorder: true,
      });
      expect(codes(crossBorder.failures)).to.deep.equal(["vehicle_yellow_card_expired"]);
    });

    it("blocks cargo above vehicle capacity but allows exactly full", () => {
      const vehicle = validVehicle({ capacityKg: 5000 });
      const full = evaluateComplianceGate({ driverProfile: validDriver(), vehicle, cargoKg: 5000 });
      expect(full.passed).to.equal(true);

      const over = evaluateComplianceGate({ driverProfile: validDriver(), vehicle, cargoKg: 5001 });
      expect(codes(over.failures)).to.deep.equal(["payload_exceeded"]);
    });

    it("blocks cargo above the EAC GVW limit even when the vehicle could carry it", () => {
      const result = evaluateComplianceGate({
        driverProfile: validDriver(),
        vehicle: validVehicle({ capacityKg: 80000 }),
        cargoKg: GVW_LIMIT_KG + 1,
      });
      expect(codes(result.failures)).to.deep.equal(["gvw_exceeded"]);
    });

    it("reports every failure at once when nothing is selected", () => {
      const result = evaluateComplianceGate({ cargoKg: GVW_LIMIT_KG + 1000 });
      expect(codes(result.failures)).to.have.members([
        "driver_not_verified",
        "vehicle_missing",
        "gvw_exceeded",
      ]);
    });
  });
});
