import { expect } from "chai";
import { asUser, loginAs, registerUser, PERSONAS, SEED } from "../helpers/auth.helper";
import { createShipment, driveShipmentTo } from "../helpers/shipment.helper";

describe("Shipment lifecycle API", () => {
  it("creates a draft shipment with a reference and packages", async () => {
    const shipper = await loginAs(PERSONAS.SHIPPER);
    const shipment = await createShipment(shipper.tokens);

    expect(shipment.reference).to.match(/^GB-\d{4}-\d{4}/);
    expect(shipment.status).to.equal("draft");
    expect(shipment.packages).to.have.length(1);
    expect(shipment.distributionOrgId).to.equal(SEED.DISTRIBUTION_ORG);
  });

  it("walks the award flow: submit → assign carrier → quote → approve", async () => {
    const { shipment } = await driveShipmentTo("awaiting_documents");

    expect(shipment.status).to.equal("awaiting_documents");
    expect(shipment.transportOrgId).to.equal(SEED.TRANSPORT_ORG);
    expect(shipment.quoteAmount).to.equal(500000);
    expect(shipment.quoteApprovedAt).to.not.be.null;
  });

  it("seeds the domestic document checklist on quote approval", async () => {
    const { shipment, shipper } = await driveShipmentTo("awaiting_documents", {
      isCrossBorder: false,
    });

    const res = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}/documents`);
    const docTypes = res.body.data.documents.map((d) => d.docType);

    expect(docTypes).to.include.members([
      "commercial_invoice",
      "packing_list",
      "insurance_certificate",
    ]);
    expect(docTypes).to.not.include("import_declaration_form"); // cross-border only
  });

  it("seeds the full cross-border checklist including corridor documents", async () => {
    const { shipment, shipper } = await driveShipmentTo("awaiting_documents", {
      isCrossBorder: true,
    });

    const res = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}/documents`);
    const docTypes = res.body.data.documents.map((d) => d.docType);

    expect(docTypes).to.include.members([
      "certificate_of_origin",
      "import_declaration_form",
      "duty_payment_receipt",
      "release_order",
      "comesa_yellow_card",
      "c2_transit_manifest",
    ]);
  });

  it("rejects invalid lifecycle transitions", async () => {
    const shipper = await loginAs(PERSONAS.SHIPPER);
    const shipment = await createShipment(shipper.tokens);

    // Cannot approve a quote on a draft
    const approveRes = await asUser(shipper.tokens).post(
      `/api/v1/shipments/${shipment.id}/approve-quote`,
    );
    expect(approveRes).to.have.status(400);

    // Submit works, second submit fails
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/submit`);
    const resubmit = await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/submit`);
    expect(resubmit).to.have.status(400);
  });

  it("blocks non-parties from viewing a shipment", async () => {
    const shipper = await loginAs(PERSONAS.SHIPPER);
    const shipment = await createShipment(shipper.tokens);

    const stranger = await registerUser();
    const res = await asUser(stranger.tokens).get(`/api/v1/shipments/${shipment.id}`);
    expect(res).to.have.status(403);
  });

  it("scopes the shipment list to the caller's organizations", async () => {
    const agent = await loginAs(PERSONAS.AGENT);
    const res = await asUser(agent.tokens).get("/api/v1/shipments");

    expect(res).to.have.status(200);
    res.body.data.shipments.forEach((s) =>
      expect(s.clearingAgentOrgId).to.equal(SEED.CLEARING_ORG),
    );
  });

  it("lets the shipper cancel before transit but not after", async () => {
    const { shipment, shipper } = await driveShipmentTo("execution_assigned");
    const cancelRes = await asUser(shipper.tokens).post(
      `/api/v1/shipments/${shipment.id}/cancel`,
    );
    expect(cancelRes).to.have.status(200);
    expect(cancelRes.body.data.shipment.status).to.equal("cancelled");

    const inTransit = await driveShipmentTo("in_transit");
    const blocked = await asUser(inTransit.shipper.tokens).post(
      `/api/v1/shipments/${inTransit.shipment.id}/cancel`,
    );
    expect(blocked).to.have.status(400);
  });
});
