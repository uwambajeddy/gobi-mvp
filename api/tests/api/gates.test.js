import { expect } from "chai";
import { asUser, loginAs, PERSONAS, SEED } from "../helpers/auth.helper";
import { driveShipmentTo, uploadAllMandatoryDocs } from "../helpers/shipment.helper";

describe("Document & compliance gates", () => {
  describe("Document gate", () => {
    it("moves the shipment to documents_complete when all mandatory docs are uploaded", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("awaiting_documents");
      expect(shipment.status).to.equal("awaiting_documents");

      await uploadAllMandatoryDocs(coordinator.tokens, shipment.id);

      const after = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}`);
      expect(after.body.data.shipment.status).to.equal("documents_complete");
    });

    it("regresses to awaiting_documents when a mandatory document is rejected", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("documents_complete");

      const docsRes = await asUser(coordinator.tokens).get(
        `/api/v1/shipments/${shipment.id}/documents`,
      );
      const target = docsRes.body.data.documents.find(
        (d) => d.mandatory && d.status === "uploaded",
      );

      const rejectRes = await asUser(coordinator.tokens).patch(
        `/api/v1/shipments/documents/${target.id}/reject`,
        { reason: "Illegible scan, please re-upload." },
      );
      expect(rejectRes).to.have.status(200);
      expect(rejectRes.body.data.shipmentStatus).to.equal("awaiting_documents");

      const after = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}`);
      expect(after.body.data.shipment.status).to.equal("awaiting_documents");
    });

    it("blocks assignment while mandatory documents are missing", async () => {
      const { shipment, coordinator } = await driveShipmentTo("awaiting_documents");

      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/assign`,
        { vehicleId: SEED.VEHICLE_COMPLIANT, driverId: SEED.DRIVER_OK_ID },
      );

      expect(res).to.have.status(400);
      expect(res.body.message).to.include("Document gate failed");
    });
  });

  describe("Compliance gate", () => {
    it("blocks assignment with an expired-insurance vehicle and expired-licence driver", async () => {
      const { shipment, coordinator } = await driveShipmentTo("documents_complete");

      const preview = await asUser(coordinator.tokens).get(
        `/api/v1/shipments/${shipment.id}/assignment-preview?vehicleId=${SEED.VEHICLE_INSURANCE_EXPIRED}&driverId=${SEED.DRIVER_EXPIRED_ID}`,
      );
      const codes = preview.body.data.complianceGate.failures.map((f) => f.code);
      expect(codes).to.include.members(["vehicle_insurance_expired", "driver_licence_expired"]);

      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/assign`,
        { vehicleId: SEED.VEHICLE_INSURANCE_EXPIRED, driverId: SEED.DRIVER_EXPIRED_ID },
      );
      expect(res).to.have.status(400);
      expect(res.body.message).to.include("Compliance gate failed");
    });

    it("blocks payload exceeding the vehicle capacity", async () => {
      // Van capacity 3,500 kg; cargo 5,000 kg
      const { shipment, coordinator } = await driveShipmentTo("documents_complete", {
        weightKg: 5000,
      });

      const preview = await asUser(coordinator.tokens).get(
        `/api/v1/shipments/${shipment.id}/assignment-preview?vehicleId=${SEED.VEHICLE_VAN_NO_YELLOW_CARD}&driverId=${SEED.DRIVER_OK_ID}`,
      );
      const codes = preview.body.data.complianceGate.failures.map((f) => f.code);
      expect(codes).to.include("payload_exceeded");
    });

    it("blocks cargo above the 56t EAC GVW limit", async () => {
      const { shipment, coordinator } = await driveShipmentTo("documents_complete", {
        weightKg: 60000,
      });

      const preview = await asUser(coordinator.tokens).get(
        `/api/v1/shipments/${shipment.id}/assignment-preview?vehicleId=${SEED.VEHICLE_COMPLIANT}&driverId=${SEED.DRIVER_OK_ID}`,
      );
      const codes = preview.body.data.complianceGate.failures.map((f) => f.code);
      expect(codes).to.include("gvw_exceeded");
    });

    it("assigns cleanly when both gates pass", async () => {
      const { shipment, coordinator } = await driveShipmentTo("documents_complete");

      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/assign`,
        { vehicleId: SEED.VEHICLE_COMPLIANT, driverId: SEED.DRIVER_OK_ID },
      );

      expect(res).to.have.status(200);
      expect(res.body.data.shipment.status).to.equal("execution_assigned");
      expect(res.body.data.overridden.documentGateOverridden).to.equal(false);
    });
  });

  describe("Audited override", () => {
    it("requires a reason to override and records full evidence in the audit log", async () => {
      const { shipment, coordinator } = await driveShipmentTo("documents_complete");

      // Override without a reason → validation error
      const noReason = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/assign`,
        {
          vehicleId: SEED.VEHICLE_INSURANCE_EXPIRED,
          driverId: SEED.DRIVER_OK_ID,
          overrideComplianceGate: true,
        },
      );
      expect(noReason).to.have.status(400);

      // Override with a reason succeeds
      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/assign`,
        {
          vehicleId: SEED.VEHICLE_INSURANCE_EXPIRED,
          driverId: SEED.DRIVER_OK_ID,
          overrideComplianceGate: true,
          overrideReason: "Insurance renewal receipt in hand; certificate issues Monday.",
        },
      );
      expect(res).to.have.status(200);
      expect(res.body.data.overridden.complianceGateOverridden).to.equal(true);

      // Audit log carries the override evidence
      const admin = await loginAs(PERSONAS.ADMIN);
      const logs = await asUser(admin.tokens).get(
        `/api/v1/admin/activity-logs?entityType=shipments&entityId=${shipment.id}&action=ASSIGN_EXECUTION`,
      );
      const entry = logs.body.data.logs[0];
      expect(entry.metadata.complianceGateOverridden).to.equal(true);
      expect(entry.metadata.overrideReason).to.include("Insurance renewal");
      expect(entry.metadata.complianceFailuresAtDispatch).to.not.be.empty;

      // ... and the timeline shows a gate_overridden event
      const events = await asUser(coordinator.tokens).get(
        `/api/v1/shipments/${shipment.id}/events`,
      );
      const types = events.body.data.events.map((e) => e.eventType);
      expect(types).to.include("gate_overridden");
    });
  });
});
