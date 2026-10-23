import { expect } from "chai";
import { Op } from "sequelize";
import { asUser, loginAs, registerUser, PERSONAS, SEED } from "../helpers/auth.helper";
import { driveShipmentTo } from "../helpers/shipment.helper";
import db from "../../src/database/models";

/**
 * Regression tests for the residual audit items: raw document links in API
 * responses, deleting a vehicle that an open shipment uses, and the conflict
 * (409) path of the quote guards.
 */

const S = (id) => `/api/v1/shipments/${id}`;

/** Seeded GB-2026-0001: a completed domestic shipment whose documents carry placeholder links. */
const SEEDED_SHIPMENT = 1;

/**
 * Runs `request` with one competing write applied just before the first
 * guarded shipment UPDATE that `before` matches, as if another user acted
 * between the handler's read and its write.
 */
const withCompetingWrite = async ({ shipmentId, before, write }, request) => {
  const { update } = db.shipments;
  let pending = true;
  db.shipments.update = async function competingUpdate(values, options) {
    if (pending && before(values)) {
      pending = false;
      await update.call(this, write, { where: { id: shipmentId } });
    }
    return update.call(this, values, options);
  };
  try {
    return await request();
  } finally {
    db.shipments.update = update;
  }
};

describe("Residual audit items", () => {
  describe("Document responses never carry a raw file link", () => {
    it("leaves stored links out of every document response, so files open only through a signed link", async () => {
      const legacy = await db.shipment_documents.findAll({
        where: { shipmentId: SEEDED_SHIPMENT, fileUrl: { [Op.ne]: null } },
      });
      expect(legacy, "seeded documents with a raw link").to.not.be.empty;

      const shipper = await loginAs(PERSONAS.SHIPPER);
      const listed = (await asUser(shipper.tokens).get(`${S(SEEDED_SHIPMENT)}/documents`)).body.data.documents;
      const workspace = (await asUser(shipper.tokens).get(S(SEEDED_SHIPMENT))).body.data.documents;
      expect(listed).to.not.be.empty;
      for (const doc of [...listed, ...workspace]) {
        expect(doc).to.not.have.property("fileUrl");
        expect(doc).to.not.have.property("fileKey");
        expect(doc.hasFile).to.equal(false);
      }

      // The signed-link route does not fall back to the raw link either.
      const file = await asUser(shipper.tokens).get(`/api/v1/shipments/documents/${legacy[0].id}/file`);
      expect(file).to.have.status(404);
      expect(JSON.stringify(file.body)).to.not.include(legacy[0].fileUrl);
    });
  });

  describe("A vehicle on an open shipment can't be deleted", () => {
    it("refuses while the shipment is open, and allows it once the shipment is closed", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("documents_complete");
      const created = await asUser(coordinator.tokens).post("/api/v1/vehicles", {
        plateNumber: `RV${String(Date.now()).slice(-6)}`,
        model: "Test truck",
        type: "truck",
        capacityKg: 30000,
        insuranceExpiresAt: "2030-01-01",
        inspectionExpiresAt: "2030-01-01",
      });
      expect(created).to.have.status(201);
      const { vehicle } = created.body.data;

      const assign = await asUser(coordinator.tokens).post(`${S(shipment.id)}/assign`, {
        vehicleId: vehicle.id,
        driverId: SEED.DRIVER_OK_ID,
      });
      expect(assign).to.have.status(200);

      const refused = await asUser(coordinator.tokens).delete(`/api/v1/vehicles/${vehicle.id}`);
      expect(refused).to.have.status(409);
      expect(refused.body.message).to.include(vehicle.plateNumber).and.include(shipment.reference);
      expect(await asUser(coordinator.tokens).get(`/api/v1/vehicles/${vehicle.id}`)).to.have.status(200);
      const kept = (await asUser(shipper.tokens).get(S(shipment.id))).body.data.shipment;
      expect(kept.assignedVehicleId).to.equal(vehicle.id);

      // Closed shipments don't hold the vehicle back, and their timeline still names it.
      expect(await asUser(shipper.tokens).post(`${S(shipment.id)}/cancel`)).to.have.status(200);
      expect(await asUser(coordinator.tokens).delete(`/api/v1/vehicles/${vehicle.id}`)).to.have.status(200);
      const events = (await asUser(shipper.tokens).get(`${S(shipment.id)}/events`)).body.data.events;
      expect(events.find((event) => event.eventType === "execution_assigned").notes).to.include(vehicle.plateNumber);
    });
  });

  describe("Quote changes that race the guarded update are a 409", () => {
    it("refuses to approve a quote that changed after it was read, then approves the new quote on retry", async () => {
      const { shipment, shipper } = await driveShipmentTo("quote");
      const approve = () => asUser(shipper.tokens).post(`${S(shipment.id)}/approve-quote`);

      const raced = await withCompetingWrite(
        {
          shipmentId: shipment.id,
          before: (values) => values.status === "quote_approved",
          write: { quoteAmount: 650000 },
        },
        approve,
      );
      expect(raced).to.have.status(409);
      expect(raced.body.message).to.include("changed while you were working on it");

      const after = (await asUser(shipper.tokens).get(S(shipment.id))).body.data;
      expect(after.shipment).to.include({ status: "submitted", quoteAmount: 650000 });
      expect(after.documents, "no checklist is seeded").to.be.empty;

      expect(await approve()).to.have.status(200);
      const approved = (await asUser(shipper.tokens).get(S(shipment.id))).body.data.shipment;
      expect(approved).to.include({ status: "awaiting_documents", quoteAmount: 650000 });
    });

    it("refuses a quote for a shipment whose carrier changed after it was read", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("carrier");
      const owner = await registerUser();
      const other = await asUser(owner.tokens).post("/api/v1/organizations", {
        name: `Residual Carrier ${Date.now()}`,
        companyType: "transport",
      });
      const otherCarrierId = other.body.data.organization.id;

      const raced = await withCompetingWrite(
        {
          shipmentId: shipment.id,
          before: (values) => values.quoteAmount != null,
          write: { transportOrgId: otherCarrierId },
        },
        () => asUser(coordinator.tokens).post(`${S(shipment.id)}/quote`, { amount: 450000 }),
      );
      expect(raced).to.have.status(409);

      const after = (await asUser(shipper.tokens).get(S(shipment.id))).body.data.shipment;
      expect(after.transportOrgId).to.equal(otherCarrierId);
      expect(after.quoteAmount).to.equal(null);
    });
  });
});
