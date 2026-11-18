import { recordSystemEvent } from "./shipmentEvents.service";

/**
 * Document Gate, adapted from the commercial dispatchGate.service.
 *
 * A mandatory document satisfies the gate when it has been uploaded or
 * verified AND is not expired. Rejected documents count as missing, which is
 * what lets a rejection regress a shipment from `documents_complete` back to
 * `awaiting_documents`.
 */

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isDocumentSatisfied = (doc) => {
  if (!["uploaded", "verified"].includes(doc.status)) return false;
  if (doc.expiresAt && new Date(doc.expiresAt) < startOfToday()) return false;
  return true;
};

export const evaluateDocumentGate = (documents = []) => {
  const missing = documents
    .filter((doc) => doc.mandatory && !isDocumentSatisfied(doc))
    .map((doc) => ({
      docType: doc.docType,
      label: doc.label,
      status: doc.status,
      reason:
        doc.status === "rejected"
          ? "Document was rejected"
          : doc.expiresAt && new Date(doc.expiresAt) < startOfToday()
            ? "Document has expired"
            : "Document not uploaded",
    }));

  return { passed: missing.length === 0, missing };
};

export const syncDocumentPhase = async (shipment, documents, { req } = {}) => {
  const gate = evaluateDocumentGate(documents);

  if (gate.passed && ["quote_approved", "awaiting_documents"].includes(shipment.status)) {
    await shipment.update({ status: "documents_complete" });
    await recordSystemEvent(shipment.id, "documents_complete", { req });
  } else if (
    !gate.passed &&
    ["quote_approved", "documents_complete"].includes(shipment.status)
  ) {
    await shipment.update({ status: "awaiting_documents" });
  }

  return gate;
};
