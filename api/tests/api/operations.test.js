import { expect } from "chai";
import { asUser, loginAs, PERSONAS } from "../helpers/auth.helper";
import { driveShipmentTo } from "../helpers/shipment.helper";

describe("Operational execution API", () => {
  describe("Event timeline", () => {
    it("records a manual milestone with actor and source", async () => {
      const { shipment, coordinator } = await driveShipmentTo("in_transit");

      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/events`,
        {
          eventType: "border_cleared",
          locationName: "Rusumo Border",
          notes: "Crossed at 15:42, seals intact",
        },
      );

      expect(res).to.have.status(201);
      expect(res.body.data.event.source).to.equal("manual");
      expect(res.body.data.event.actor.firstName).to.be.a("string");
    });

    it("advances the lifecycle via picked_up and arrived_destination events", async () => {
      const { shipment, coordinator } = await driveShipmentTo("execution_assigned");

      const pickup = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/events`,
        { eventType: "picked_up", locationName: "Origin depot" },
      );
      expect(pickup.body.data.shipmentStatus).to.equal("in_transit");

      const arrival = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/events`,
        { eventType: "arrived_destination", locationName: "Destination" },
      );
      expect(arrival.body.data.shipmentStatus).to.equal("arrived");
    });

    it("rejects lifecycle events out of order", async () => {
      const { shipment, coordinator } = await driveShipmentTo("execution_assigned");

      // arrived_destination requires in_transit
      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/events`,
        { eventType: "arrived_destination" },
      );
      expect(res).to.have.status(400);
    });

    it("rejects operational events before execution is assigned", async () => {
      const { shipment, coordinator } = await driveShipmentTo("documents_complete");

      const res = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/events`,
        { eventType: "checkpoint", locationName: "Somewhere" },
      );
      expect(res).to.have.status(400);
    });
  });

  describe("POD & completion", () => {
    it("captures POD (arrived → delivered) and completes (→ completed)", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("arrived");

      const pod = await asUser(coordinator.tokens).post(`/api/v1/shipments/${shipment.id}/pod`, {
        podRecipientName: "Jean Receiver",
        podNotes: "All packages intact.",
      });
      expect(pod).to.have.status(200);
      expect(pod.body.data.shipment.status).to.equal("delivered");

      const complete = await asUser(shipper.tokens).post(
        `/api/v1/shipments/${shipment.id}/complete`,
      );
      expect(complete).to.have.status(200);
      expect(complete.body.data.shipment.status).to.equal("completed");
    });

    it("blocks POD before arrival and completion by the carrier", async () => {
      const inTransit = await driveShipmentTo("in_transit");
      const early = await asUser(inTransit.coordinator.tokens).post(
        `/api/v1/shipments/${inTransit.shipment.id}/pod`,
        { podRecipientName: "Too Early" },
      );
      expect(early).to.have.status(400);

      const delivered = await driveShipmentTo("delivered");
      const wrongParty = await asUser(delivered.coordinator.tokens).post(
        `/api/v1/shipments/${delivered.shipment.id}/complete`,
      );
      expect(wrongParty).to.have.status(403);
    });

    it("blocks completion while an exception is open, then allows it after resolution", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("delivered");

      const exception = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/exceptions`,
        { type: "cargo_damage", severity: "high", notes: "Two crates dented on arrival." },
      );
      expect(exception).to.have.status(201);

      const blocked = await asUser(shipper.tokens).post(
        `/api/v1/shipments/${shipment.id}/complete`,
      );
      expect(blocked).to.have.status(400);
      expect(blocked.body.message).to.include("exception");

      await asUser(coordinator.tokens).patch(
        `/api/v1/shipments/exceptions/${exception.body.data.exception.id}/resolve`,
        { resolutionNotes: "Client accepted compensation; claim settled." },
      );

      const completed = await asUser(shipper.tokens).post(
        `/api/v1/shipments/${shipment.id}/complete`,
      );
      expect(completed).to.have.status(200);
    });
  });

  describe("Payments ledger", () => {
    it("records a payment with proof and marks pending payments paid", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("in_transit");

      const withProof = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/payments`,
        {
          type: "border_fee",
          amount: 85000,
          proofFileName: "border-fee.pdf",
          proofUrl: "https://files.gobi.local/test/border-fee.pdf",
        },
      );
      expect(withProof).to.have.status(201);
      expect(withProof.body.data.payment.status).to.equal("paid");

      const pending = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/payments`,
        { type: "customs_duty", amount: 1450000 },
      );
      expect(pending.body.data.payment.status).to.equal("pending");

      const settled = await asUser(coordinator.tokens).patch(
        `/api/v1/shipments/payments/${pending.body.data.payment.id}/mark-paid`,
        {},
      );
      expect(settled.body.data.payment.status).to.equal("paid");

      // Shipper has read-only visibility of the ledger
      const ledger = await asUser(shipper.tokens).get(
        `/api/v1/shipments/${shipment.id}/payments`,
      );
      expect(ledger.body.data.payments).to.have.length(2);
    });

    it("blocks the shipper from recording payments", async () => {
      const { shipment, shipper } = await driveShipmentTo("in_transit");

      const res = await asUser(shipper.tokens).post(
        `/api/v1/shipments/${shipment.id}/payments`,
        { type: "port_fee", amount: 100 },
      );
      expect(res).to.have.status(403);
    });
  });
});
