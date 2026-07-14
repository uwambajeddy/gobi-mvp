import { asUser, loginAs, PERSONAS, SEED } from "./auth.helper";

/**
 * Walks a FRESH shipment through the lifecycle using the seeded personas.
 * Each test creates its own shipment so the seeded demo data stays intact.
 */

export const createShipment = async (shipperTokens, overrides = {}) => {
  const res = await asUser(shipperTokens).post("/api/v1/shipments", {
    title: `Test shipment ${Date.now()}`,
    originAddress: "Test Origin Depot, Kigali",
    destinationAddress: "Test Destination, Musanze",
    isCrossBorder: false,
    recipientName: "Test Receiver",
    recipientPhone: "+250788999888",
    packages: [{ description: "Test cargo", weightKg: 1000, quantity: 1 }],
    ...overrides,
  });
  if (res.status !== 201) {
    throw new Error(`createShipment failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.shipment;
};

/** Uploads every unsatisfied mandatory document as the given user. */
export const uploadAllMandatoryDocs = async (tokens, shipmentId) => {
  const listRes = await asUser(tokens).get(`/api/v1/shipments/${shipmentId}/documents`);
  const documents = listRes.body.data.documents;

  for (const doc of documents) {
    if (doc.mandatory && !["uploaded", "verified"].includes(doc.status)) {
      const res = await asUser(tokens).post(`/api/v1/shipments/${shipmentId}/documents`, {
        docType: doc.docType,
        fileName: `${doc.docType}.pdf`,
        fileUrl: `https://files.gobi.local/test/${doc.docType}.pdf`,
      });
      if (res.status !== 201) {
        throw new Error(`upload ${doc.docType} failed: ${JSON.stringify(res.body)}`);
      }
    }
  }
};

/**
 * Drives a fresh shipment to the requested status.
 * Returns { shipment, shipper, coordinator } (tokens included).
 */
export const driveShipmentTo = async (targetStatus, { isCrossBorder = false, weightKg = 1000 } = {}) => {
  const shipper = await loginAs(PERSONAS.SHIPPER);
  const coordinator = await loginAs(PERSONAS.COORDINATOR);

  let shipment = await createShipment(shipper.tokens, {
    isCrossBorder,
    packages: [{ description: "Test cargo", weightKg, quantity: 1 }],
  });
  const id = shipment.id;
  const steps = [];

  steps.push(["draft", null]);
  steps.push(["submitted", () => asUser(shipper.tokens).post(`/api/v1/shipments/${id}/submit`)]);
  steps.push([
    "carrier",
    () =>
      asUser(shipper.tokens).post(`/api/v1/shipments/${id}/assign-carrier`, {
        transportOrgId: SEED.TRANSPORT_ORG,
      }),
  ]);
  steps.push([
    "quote",
    () => asUser(coordinator.tokens).post(`/api/v1/shipments/${id}/quote`, { amount: 500000 }),
  ]);
  steps.push([
    "awaiting_documents",
    () => asUser(shipper.tokens).post(`/api/v1/shipments/${id}/approve-quote`),
  ]);
  steps.push([
    "documents_complete",
    () => uploadAllMandatoryDocs(coordinator.tokens, id),
  ]);
  steps.push([
    "execution_assigned",
    () =>
      asUser(coordinator.tokens).post(`/api/v1/shipments/${id}/assign`, {
        vehicleId: SEED.VEHICLE_COMPLIANT,
        driverId: SEED.DRIVER_OK_ID,
      }),
  ]);
  steps.push([
    "in_transit",
    () =>
      asUser(coordinator.tokens).post(`/api/v1/shipments/${id}/events`, {
        eventType: "picked_up",
        locationName: "Test Origin Depot",
      }),
  ]);
  steps.push([
    "arrived",
    () =>
      asUser(coordinator.tokens).post(`/api/v1/shipments/${id}/events`, {
        eventType: "arrived_destination",
        locationName: "Test Destination",
      }),
  ]);
  steps.push([
    "delivered",
    () =>
      asUser(coordinator.tokens).post(`/api/v1/shipments/${id}/pod`, {
        podRecipientName: "Test Receiver",
        podNotes: "Received in full",
      }),
  ]);
  steps.push([
    "completed",
    () => asUser(shipper.tokens).post(`/api/v1/shipments/${id}/complete`),
  ]);

  const order = [
    "draft",
    "submitted",
    "carrier",
    "quote",
    "awaiting_documents",
    "documents_complete",
    "execution_assigned",
    "in_transit",
    "arrived",
    "delivered",
    "completed",
  ];
  const targetIndex = order.indexOf(targetStatus);
  if (targetIndex === -1) throw new Error(`Unknown target status: ${targetStatus}`);

  for (let i = 1; i <= targetIndex; i += 1) {
    const [, action] = steps[i];
    if (action) {
      const res = await action();
      if (res && res.status >= 400) {
        throw new Error(
          `driveShipmentTo failed at step "${order[i]}": ${JSON.stringify(res.body)}`,
        );
      }
    }
  }

  const finalRes = await asUser(shipper.tokens).get(`/api/v1/shipments/${id}`);
  shipment = finalRes.body.data.shipment;

  return { shipment, shipper, coordinator };
};
