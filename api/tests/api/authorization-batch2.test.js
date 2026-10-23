import { expect } from "chai";
import { asUser, loginAs, registerUser, PERSONAS, SEED } from "../helpers/auth.helper";
import { createShipment, driveShipmentTo } from "../helpers/shipment.helper";
import { SAMPLE_PDF, SAMPLE_TEXT, pdfFile } from "../helpers/files.helper";
import { enrollDriver } from "../helpers/organization.helper";

/**
 * Regression tests for audit items R-7 (uploads are authorized before the
 * file is read), F-05 (assignment preview stays inside the carrier's fleet),
 * Q-2 (drivers see no quotes or payments) and F-06 (a carrier change clears
 * the previous carrier's quote).
 */

const S = (id) => `/api/v1/shipments/${id}`;

/** Bigger than the 10 MB limit: multer would refuse it with 400 if it ever read it. */
const oversizedPdf = () => ({
  buffer: Buffer.concat([SAMPLE_PDF, Buffer.alloc(10 * 1024 * 1024)]),
  name: "huge.pdf",
  type: "application/pdf",
});
const textFile = () => ({ buffer: SAMPLE_TEXT, name: "notes.txt", type: "text/plain" });

/** A fresh carrier with one vehicle and one driver of its own. */
const createCarrier = async () => {
  const owner = await registerUser();
  const org = await asUser(owner.tokens).post("/api/v1/organizations", {
    name: `Batch2 Carrier ${Date.now()}`,
    companyType: "transport",
  });
  const orgId = org.body.data.organization.id;

  const driver = await registerUser();
  await enrollDriver(owner, orgId, driver);
  const vehicle = await asUser(owner.tokens).post("/api/v1/vehicles", {
    plateNumber: `BZ${String(Date.now()).slice(-6)}`,
    model: "Test truck",
    type: "truck",
    capacityKg: 30000,
  });

  return { owner, orgId, driver, vehicleId: vehicle.body.data.vehicle.id };
};

/** A submitted shipment from the seeded shipper, offered to `transportOrgId`. */
const submittedShipmentFor = async (shipper, transportOrgId) => {
  const shipment = await createShipment(shipper.tokens);
  await asUser(shipper.tokens).post(`${S(shipment.id)}/submit`);
  await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-carrier`, { transportOrgId });
  return shipment;
};

describe("Security batch 2", () => {
  describe("Uploads are authorized before the file is read (R-7)", () => {
    let shipment;
    let shipper;
    let coordinator;
    let driver;

    before(async () => {
      ({ shipment, shipper, coordinator } = await driveShipmentTo("awaiting_documents"));
      driver = await loginAs(PERSONAS.DRIVER_OK); // not assigned to this shipment
    });

    it("refuses a non-party's document upload with 403 before parsing an oversized or wrong-type file", async () => {
      const outsider = await loginAs(PERSONAS.AGENT); // ClearFast is not on this shipment
      const before = (await asUser(coordinator.tokens).get(`${S(shipment.id)}/documents`)).body.data.documents;

      const huge = await asUser(outsider.tokens).upload(
        `${S(shipment.id)}/documents`,
        { docType: "commercial_invoice" },
        oversizedPdf(),
      );
      expect(huge).to.have.status(403);
      expect(huge.body.message).to.not.include("10 MB");

      const text = await asUser(driver.tokens).upload(
        `${S(shipment.id)}/documents`,
        { docType: "commercial_invoice" },
        textFile(),
      );
      expect(text).to.have.status(403);
      expect(text.body.message).to.not.include("PDF, JPG or PNG");

      const after = (await asUser(coordinator.tokens).get(`${S(shipment.id)}/documents`)).body.data.documents;
      expect(after).to.deep.equal(before);
    });

    it("refuses payment and proof uploads from non-coordinators with 403 before parsing the file", async () => {
      const record = await asUser(shipper.tokens).upload(
        `${S(shipment.id)}/payments`,
        { type: "port_fee", amount: 5000 },
        oversizedPdf(),
      );
      expect(record).to.have.status(403);

      const pending = await asUser(coordinator.tokens).post(`${S(shipment.id)}/payments`, {
        type: "warehouse_fee",
        amount: 7000,
      });
      expect(pending).to.have.status(201);
      const paymentId = pending.body.data.payment.id;

      const proof = await asUser(shipper.tokens).upload(
        `/api/v1/shipments/payments/${paymentId}/proof`,
        {},
        oversizedPdf(),
      );
      expect(proof).to.have.status(403);

      const payments = (await asUser(coordinator.tokens).get(`${S(shipment.id)}/payments`)).body.data.payments;
      expect(payments).to.have.length(1);
      expect(payments[0].status).to.equal("pending");
      expect(payments[0].hasProof).to.equal(false);
    });

    it("checks the shipment stage before reading a party's file", async () => {
      const draft = await createShipment(shipper.tokens);
      const res = await asUser(shipper.tokens).upload(
        `${S(draft.id)}/documents`,
        { docType: "commercial_invoice" },
        oversizedPdf(),
      );
      expect(res).to.have.status(400);
      expect(res.body.message).to.include("after quote approval");
    });

    it("still accepts a party's valid upload and enforces the size limit for them", async () => {
      const ok = await asUser(shipper.tokens).upload(
        `${S(shipment.id)}/documents`,
        { docType: "packing_list" },
        pdfFile("packing.pdf"),
      );
      expect(ok).to.have.status(201);

      const tooBig = await asUser(shipper.tokens).upload(
        `${S(shipment.id)}/documents`,
        { docType: "commercial_invoice" },
        oversizedPdf(),
      );
      expect(tooBig).to.have.status(400);
      expect(tooBig.body.message).to.include("10 MB");
    });
  });

  describe("Assignment preview stays inside the carrier's own fleet (F-05)", () => {
    let carrier;
    let shipment;

    before(async () => {
      const shipper = await loginAs(PERSONAS.SHIPPER);
      carrier = await createCarrier();
      shipment = await submittedShipmentFor(shipper, carrier.orgId);
    });

    const preview = (tokens, vehicleId, driverId) =>
      asUser(tokens).get(
        `${S(shipment.id)}/assignment-preview?vehicleId=${vehicleId}&driverId=${driverId}`,
      );

    it("refuses another carrier's vehicle or driver without revealing their compliance data", async () => {
      const foreignVehicle = await preview(carrier.owner.tokens, SEED.VEHICLE_INSURANCE_EXPIRED, carrier.driver.user.id);
      expect(foreignVehicle).to.have.status(400);
      expect(foreignVehicle.body).to.not.have.nested.property("data.complianceGate");
      expect(JSON.stringify(foreignVehicle.body)).to.not.include("expired");

      const foreignDriver = await preview(carrier.owner.tokens, carrier.vehicleId, SEED.DRIVER_EXPIRED_ID);
      expect(foreignDriver).to.have.status(400);
      expect(JSON.stringify(foreignDriver.body)).to.not.include("expired");
    });

    it("answers an unknown id exactly like another carrier's id", async () => {
      const foreign = await preview(carrier.owner.tokens, SEED.VEHICLE_COMPLIANT, carrier.driver.user.id);
      const unknown = await preview(carrier.owner.tokens, 99999999, carrier.driver.user.id);
      expect(unknown).to.have.status(400);
      expect(unknown.body.message).to.equal(foreign.body.message);
    });

    it("previews the carrier's own vehicle and driver", async () => {
      const own = await preview(carrier.owner.tokens, carrier.vehicleId, carrier.driver.user.id);
      expect(own).to.have.status(200);
      expect(own.body.data.complianceGate.failures.map((f) => f.code)).to.include("driver_not_verified");
    });

    it("refuses another carrier's vehicle at assignment too", async () => {
      const shipper = await loginAs(PERSONAS.SHIPPER);
      const { shipment: docsPhase, coordinator } = await driveShipmentTo("documents_complete");
      const res = await asUser(coordinator.tokens).post(`${S(docsPhase.id)}/assign`, {
        vehicleId: carrier.vehicleId,
        driverId: SEED.DRIVER_OK_ID,
      });
      expect(res).to.have.status(400);
      expect(res.body.message).to.include("fleet");
      expect(await asUser(shipper.tokens).get(S(docsPhase.id))).to.have.nested.property(
        "body.data.shipment.status",
        "documents_complete",
      );
    });

    it("keeps the seeded carrier's coordinator and the admin able to preview that carrier's fleet", async () => {
      const { shipment: docsPhase, coordinator } = await driveShipmentTo("documents_complete");
      const url = `${S(docsPhase.id)}/assignment-preview?vehicleId=${SEED.VEHICLE_COMPLIANT}&driverId=${SEED.DRIVER_OK_ID}`;

      const asCoordinator = await asUser(coordinator.tokens).get(url);
      expect(asCoordinator).to.have.status(200);
      expect(asCoordinator.body.data.complianceGate.passed).to.equal(true);

      const admin = await loginAs(PERSONAS.ADMIN);
      expect(await asUser(admin.tokens).get(url)).to.have.status(200);
    });
  });

  describe("Drivers see no quotes or payments (Q-2)", () => {
    const PAYMENT_AMOUNT = 98765;
    let shipment;
    let shipper;
    let coordinator;
    let driver;
    let paymentId;

    before(async () => {
      ({ shipment, shipper, coordinator } = await driveShipmentTo("execution_assigned"));
      driver = await loginAs(PERSONAS.DRIVER_OK); // the assigned driver
      const payment = await asUser(coordinator.tokens).upload(
        `${S(shipment.id)}/payments`,
        { type: "port_fee", amount: PAYMENT_AMOUNT },
        pdfFile("receipt.pdf"),
      );
      paymentId = payment.body.data.payment.id;
    });

    it("leaves the quote out of the driver's shipment and list", async () => {
      const detail = await asUser(driver.tokens).get(S(shipment.id));
      expect(detail).to.have.status(200);
      expect(detail.body.data.shipment).to.not.have.any.keys("quoteAmount", "quoteCurrency");
      expect(detail.body.data.access.can.viewFinancials).to.equal(false);
      expect(detail.body.data.access.can.listPayments).to.equal(false);

      const list = (await asUser(driver.tokens).get("/api/v1/shipments")).body.data.shipments;
      const row = list.find((s) => s.id === shipment.id);
      expect(row).to.exist;
      list.forEach((s) => expect(s).to.not.have.any.keys("quoteAmount", "quoteCurrency"));
    });

    it("refuses the driver the payment ledger and proof files", async () => {
      expect(await asUser(driver.tokens).get(`${S(shipment.id)}/payments`)).to.have.status(403);
      expect(await asUser(driver.tokens).get(`/api/v1/shipments/payments/${paymentId}/proof`)).to.have.status(403);
    });

    it("drops amounts from quote and payment events on the driver's timeline", async () => {
      const events = (await asUser(driver.tokens).get(`${S(shipment.id)}/events`)).body.data.events;
      const quote = events.find((e) => e.eventType === "quote_approved");
      const payment = events.find((e) => e.eventType === "payment_recorded");

      expect(quote.metadata).to.equal(null);
      expect(payment.notes).to.equal("port fee");
      expect(payment.metadata).to.deep.equal({ type: "port_fee" });
      expect(JSON.stringify(events)).to.not.include(String(PAYMENT_AMOUNT));
      expect(JSON.stringify(events)).to.not.include("500000");
    });

    it("leaves the quote out of the driver's POD response", async () => {
      await asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "picked_up" });
      await asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "arrived_destination" });
      const pod = await asUser(driver.tokens).post(`${S(shipment.id)}/pod`, { podRecipientName: "Receiver" });
      expect(pod).to.have.status(200);
      expect(pod.body.data.shipment.status).to.equal("delivered");
      expect(pod.body.data.shipment).to.not.have.any.keys("quoteAmount", "quoteCurrency");
    });

    it("keeps quotes, payments and amounts for the shipper, the carrier and the admin", async () => {
      const admin = await loginAs(PERSONAS.ADMIN);
      for (const viewer of [shipper, coordinator, admin]) {
        const detail = await asUser(viewer.tokens).get(S(shipment.id));
        expect(detail.body.data.shipment.quoteAmount).to.equal(500000);
        expect(detail.body.data.access.can.viewFinancials).to.equal(true);
        expect(await asUser(viewer.tokens).get(`${S(shipment.id)}/payments`)).to.have.status(200);
      }

      const events = (await asUser(shipper.tokens).get(`${S(shipment.id)}/events`)).body.data.events;
      const payment = events.find((e) => e.eventType === "payment_recorded");
      expect(payment.notes).to.include(String(PAYMENT_AMOUNT));
      expect(events.find((e) => e.eventType === "quote_approved").metadata.amount).to.equal(500000);
    });
  });

  describe("A carrier change clears the previous carrier's quote (F-06)", () => {
    let shipper;
    let coordinator;

    before(async () => {
      shipper = await loginAs(PERSONAS.SHIPPER);
      coordinator = await loginAs(PERSONAS.COORDINATOR);
    });

    it("clears the quote on reassignment, so it can't be approved for the new carrier", async () => {
      const carrier = await createCarrier();
      const shipment = await submittedShipmentFor(shipper, SEED.TRANSPORT_ORG);
      const quoted = await asUser(coordinator.tokens).post(`${S(shipment.id)}/quote`, { amount: 777000 });
      expect(quoted).to.have.status(200);

      const swap = await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-carrier`, {
        transportOrgId: carrier.orgId,
      });
      expect(swap).to.have.status(200);
      expect(swap.body.data.shipment.transportOrgId).to.equal(carrier.orgId);
      expect(swap.body.data.shipment.quoteAmount).to.equal(null);

      const approve = await asUser(shipper.tokens).post(`${S(shipment.id)}/approve-quote`);
      expect(approve).to.have.status(400);
      expect(approve.body.message).to.include("quote submitted");

      // The replaced carrier can no longer quote.
      const oldQuote = await asUser(coordinator.tokens).post(`${S(shipment.id)}/quote`, { amount: 1 });
      expect(oldQuote).to.have.status(403);

      const events = (await asUser(shipper.tokens).get(`${S(shipment.id)}/events`)).body.data.events;
      const reassigned = events.find(
        (e) => e.eventType === "carrier_assigned" && e.metadata?.transportOrgId === carrier.orgId,
      );
      expect(reassigned.metadata).to.include({
        previousTransportOrgId: SEED.TRANSPORT_ORG,
        quoteCleared: true,
      });
    });

    it("approves the new carrier's own quote", async () => {
      const carrier = await createCarrier();
      const shipment = await submittedShipmentFor(shipper, SEED.TRANSPORT_ORG);
      await asUser(coordinator.tokens).post(`${S(shipment.id)}/quote`, { amount: 777000 });
      await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-carrier`, { transportOrgId: carrier.orgId });

      const newQuote = await asUser(carrier.owner.tokens).post(`${S(shipment.id)}/quote`, { amount: 450000 });
      expect(newQuote).to.have.status(200);

      const approve = await asUser(shipper.tokens).post(`${S(shipment.id)}/approve-quote`);
      expect(approve).to.have.status(200);
      expect(approve.body.data.shipment.quoteAmount).to.equal(450000);
      expect(approve.body.data.shipment.transportOrgId).to.equal(carrier.orgId);
    });

    it("keeps the quote when the same carrier is assigned again", async () => {
      const shipment = await submittedShipmentFor(shipper, SEED.TRANSPORT_ORG);
      await asUser(coordinator.tokens).post(`${S(shipment.id)}/quote`, { amount: 600000 });

      const again = await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-carrier`, {
        transportOrgId: SEED.TRANSPORT_ORG,
      });
      expect(again).to.have.status(200);
      expect(again.body.data.shipment.quoteAmount).to.equal(600000);

      const approve = await asUser(shipper.tokens).post(`${S(shipment.id)}/approve-quote`);
      expect(approve).to.have.status(200);
    });
  });
});
