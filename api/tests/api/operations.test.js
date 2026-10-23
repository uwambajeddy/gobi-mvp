import { expect } from "chai";
import { asUser, loginAs, PERSONAS } from "../helpers/auth.helper";
import { driveShipmentTo } from "../helpers/shipment.helper";
import { SAMPLE_TEXT, pdfFile } from "../helpers/files.helper";

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
    it("records a payment with an uploaded proof and marks pending payments paid", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("in_transit");

      const withProof = await asUser(coordinator.tokens).upload(
        `/api/v1/shipments/${shipment.id}/payments`,
        { type: "border_fee", amount: 85000 },
        pdfFile("border-fee.pdf"),
      );
      expect(withProof).to.have.status(201);
      expect(withProof.body.data.payment.status).to.equal("paid");
      expect(withProof.body.data.payment.hasProof).to.equal(true);
      expect(withProof.body.data.payment.proofFileName).to.equal("border-fee.pdf");
      // Storage details never leave the server.
      expect(withProof.body.data.payment).to.not.have.property("proofFileKey");

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

    it("attaches proof to a pending payment and lets every party view it", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("in_transit");

      const pending = await asUser(coordinator.tokens).post(
        `/api/v1/shipments/${shipment.id}/payments`,
        { type: "port_fee", amount: 320000 },
      );
      const paymentId = pending.body.data.payment.id;
      expect(pending.body.data.payment.hasProof).to.equal(false);

      const noProofYet = await asUser(shipper.tokens).get(`/api/v1/shipments/payments/${paymentId}/proof`);
      expect(noProofYet).to.have.status(404);

      const attached = await asUser(coordinator.tokens).upload(
        `/api/v1/shipments/payments/${paymentId}/proof`,
        {},
        pdfFile("port-receipt.pdf"),
      );
      expect(attached).to.have.status(200);
      expect(attached.body.data.payment.status).to.equal("paid");
      expect(attached.body.data.payment.hasProof).to.equal(true);

      // The shipper is a party: read-only, but may view the proof.
      const link = await asUser(shipper.tokens).get(`/api/v1/shipments/payments/${paymentId}/proof`);
      expect(link).to.have.status(200);
      expect(link.body.data.url).to.be.a("string");
      expect(link.body.data.fileName).to.equal("port-receipt.pdf");
      expect(link.body.data.mimeType).to.equal("application/pdf");

      const shipperAttach = await asUser(shipper.tokens).upload(
        `/api/v1/shipments/payments/${paymentId}/proof`,
        {},
        pdfFile("other.pdf"),
      );
      expect(shipperAttach).to.have.status(403);
    });

    it("rejects proof files whose content is not a PDF, JPG or PNG", async () => {
      const { shipment, coordinator } = await driveShipmentTo("in_transit");

      const res = await asUser(coordinator.tokens).upload(
        `/api/v1/shipments/${shipment.id}/payments`,
        { type: "border_fee", amount: 85000 },
        { buffer: SAMPLE_TEXT, name: "receipt.pdf", type: "application/pdf" },
      );
      expect(res).to.have.status(400);

      const ledger = await asUser(coordinator.tokens).get(`/api/v1/shipments/${shipment.id}/payments`);
      expect(ledger.body.data.payments).to.have.length(0);
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
