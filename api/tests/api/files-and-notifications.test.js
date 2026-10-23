import { expect } from "chai";
import { asUser, loginAs, PERSONAS, SEED } from "../helpers/auth.helper";
import { createShipment, driveShipmentTo, uploadAllMandatoryDocs } from "../helpers/shipment.helper";
import { SAMPLE_PDF, SAMPLE_PNG, SAMPLE_TEXT, pdfFile } from "../helpers/files.helper";
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";

const documentsUrl = (shipmentId) => `/api/v1/shipments/${shipmentId}/documents`;
const fileUrl = (docId) => `/api/v1/shipments/documents/${docId}/file`;

const firstMandatoryDoc = async (tokens, shipmentId) => {
  const res = await asUser(tokens).get(documentsUrl(shipmentId));
  return res.body.data.documents.find((doc) => doc.mandatory);
};

describe("Document files", () => {
  it("stores an uploaded file and lets parties view it through a short-lived link", async () => {
    const { shipment, shipper, coordinator } = await driveShipmentTo("awaiting_documents");
    const target = await firstMandatoryDoc(shipper.tokens, shipment.id);

    const upload = await asUser(shipper.tokens).upload(
      documentsUrl(shipment.id),
      { docType: target.docType },
      pdfFile("commercial-invoice.pdf"),
    );
    expect(upload).to.have.status(201);
    const { document } = upload.body.data;
    expect(document.hasFile).to.equal(true);
    expect(document.fileName).to.equal("commercial-invoice.pdf");
    expect(document.fileMimeType).to.equal("application/pdf");
    expect(document.fileSize).to.equal(SAMPLE_PDF.length);
    expect(document).to.not.have.property("fileKey");

    const view = await asUser(coordinator.tokens).get(fileUrl(document.id));
    expect(view).to.have.status(200);
    expect(view.body.data.url).to.be.a("string").and.not.equal("");
    expect(view.body.data.fileName).to.equal("commercial-invoice.pdf");
    const ttlMs = new Date(view.body.data.expiresAt).getTime() - Date.now();
    expect(ttlMs).to.be.within(60 * 1000, 10 * 60 * 1000);
  });

  it("accepts images and records their real type", async () => {
    const { shipment, shipper } = await driveShipmentTo("awaiting_documents");
    const target = await firstMandatoryDoc(shipper.tokens, shipment.id);

    const res = await asUser(shipper.tokens).upload(
      documentsUrl(shipment.id),
      { docType: target.docType },
      { buffer: SAMPLE_PNG, name: "scan.png", type: "image/png" },
    );
    expect(res).to.have.status(201);
    expect(res.body.data.document.fileMimeType).to.equal("image/png");
  });

  it("refuses uploads with no file, an unsupported type, spoofed content or over 10 MB", async () => {
    const { shipment, shipper } = await driveShipmentTo("awaiting_documents");
    const target = await firstMandatoryDoc(shipper.tokens, shipment.id);
    const fields = { docType: target.docType };
    const upload = (file) => asUser(shipper.tokens).upload(documentsUrl(shipment.id), fields, file);

    const missing = await upload();
    expect(missing).to.have.status(400);
    expect(missing.body.message).to.include("Attach the document file");

    const wrongType = await upload({ buffer: SAMPLE_TEXT, name: "notes.txt", type: "text/plain" });
    expect(wrongType).to.have.status(400);
    expect(wrongType.body.message).to.include("PDF, JPG or PNG");

    const spoofed = await upload({ buffer: SAMPLE_TEXT, name: "invoice.pdf", type: "application/pdf" });
    expect(spoofed).to.have.status(400);
    expect(spoofed.body.message).to.include("content is not a PDF");

    const oversized = Buffer.concat([SAMPLE_PDF, Buffer.alloc(10 * 1024 * 1024)]);
    const tooBig = await upload({ buffer: oversized, name: "huge.pdf", type: "application/pdf" });
    expect(tooBig).to.have.status(400);
    expect(tooBig.body.message).to.include("10 MB");

    const after = await asUser(shipper.tokens).get(documentsUrl(shipment.id));
    const row = after.body.data.documents.find((doc) => doc.id === target.id);
    expect(row.status).to.equal("required");
    expect(row.hasFile).to.equal(false);
  });

  it("hides files from non-parties and reports documents without a file", async () => {
    const { shipment, shipper } = await driveShipmentTo("awaiting_documents");
    const target = await firstMandatoryDoc(shipper.tokens, shipment.id);

    const noFile = await asUser(shipper.tokens).get(fileUrl(target.id));
    expect(noFile).to.have.status(404);
    expect(noFile.body.message).to.include("No file is stored");

    await asUser(shipper.tokens).upload(documentsUrl(shipment.id), { docType: target.docType }, pdfFile());

    // ClearFast is not a party to this domestic shipment.
    const agent = await loginAs(PERSONAS.AGENT);
    const outsider = await asUser(agent.tokens).get(fileUrl(target.id));
    expect(outsider).to.have.status(403);
  });
});

describe("Email notifications", () => {
  beforeEach(async () => {
    await flushNotifications();
    testOutbox.length = 0;
  });

  const sentTo = (email, tag) => testOutbox.filter((message) => message.to.email === email && (!tag || message.tag === tag));

  it("emails the carrier's coordinators when a carrier is assigned, but not the person acting", async () => {
    const shipper = await loginAs(PERSONAS.SHIPPER);
    const shipment = await createShipment(shipper.tokens);
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/submit`);
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/assign-carrier`, {
      transportOrgId: SEED.TRANSPORT_ORG,
    });
    await flushNotifications();

    for (const email of [PERSONAS.CARRIER_OWNER, PERSONAS.COORDINATOR]) {
      const [message] = sentTo(email, "carrier_assigned");
      expect(message, `email to ${email}`).to.exist;
      expect(message.subject).to.equal(`New shipment request: ${shipment.reference}`);
      expect(message.text).to.include(`/dashboard/shipments/${shipment.id}`);
    }
    expect(sentTo(PERSONAS.SHIPPER)).to.have.length(0);
  });

  it("tells the shipper when a quote arrives", async () => {
    const shipper = await loginAs(PERSONAS.SHIPPER);
    const coordinator = await loginAs(PERSONAS.COORDINATOR);
    const shipment = await createShipment(shipper.tokens);
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/submit`);
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/assign-carrier`, {
      transportOrgId: SEED.TRANSPORT_ORG,
    });
    await asUser(coordinator.tokens).post(`/api/v1/shipments/${shipment.id}/quote`, { amount: 450000 });
    await flushNotifications();

    const [message] = sentTo(PERSONAS.SHIPPER, "quote_submitted");
    expect(message).to.exist;
    expect(message.subject).to.include("RWF 450,000");
  });

  it("tells the uploader when their document is rejected, with the reason", async () => {
    const { shipment, shipper, coordinator } = await driveShipmentTo("awaiting_documents");
    await uploadAllMandatoryDocs(shipper.tokens, shipment.id);
    const target = await firstMandatoryDoc(shipper.tokens, shipment.id);

    await asUser(coordinator.tokens).patch(`/api/v1/shipments/documents/${target.id}/reject`, {
      reason: "Scan is illegible",
    });
    await flushNotifications();

    const [message] = sentTo(PERSONAS.SHIPPER, "document_rejected");
    expect(message).to.exist;
    expect(message.subject).to.include(target.label);
    expect(message.text).to.include("Scan is illegible");
    expect(sentTo(PERSONAS.COORDINATOR, "document_rejected")).to.have.length(0);
  });

  it("escapes text that users typed", async () => {
    const shipper = await loginAs(PERSONAS.SHIPPER);
    const shipment = await createShipment(shipper.tokens, { title: "<b>Cement</b> & co" });
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/submit`);
    await asUser(shipper.tokens).post(`/api/v1/shipments/${shipment.id}/assign-carrier`, {
      transportOrgId: SEED.TRANSPORT_ORG,
    });
    await flushNotifications();

    const [message] = sentTo(PERSONAS.COORDINATOR, "carrier_assigned");
    expect(message.html).to.include("&lt;b&gt;Cement&lt;/b&gt; &amp; co");
    expect(message.html).to.not.include("<b>Cement</b>");
  });
});
