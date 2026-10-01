import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { evaluateDocumentGate, syncDocumentPhase } from "../services/documentGate.service";
import { getShipmentWithContext } from "../services/shipmentAccess.service";
import { getDocumentType } from "../config/shipmentDocuments";
import db from "../database/models";

const { ok, created, badRequest, notFound, forbidden } = statusCodes;
const { shipment_documents, shipments } = db;

const loadDocuments = (shipmentId) =>
  shipment_documents.findAll({ where: { shipmentId }, order: [["id", "ASC"]] });

/**
 * GET /api/v1/shipments/:id/documents: checklist + document gate result.
 */
export const listDocuments = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isParty) {
    return next(new AppError("You are not a party to this shipment.", forbidden));
  }

  const documents = await loadDocuments(shipment.id);
  const gate = evaluateDocumentGate(documents);

  return successResponse(res, ok, { documents, gate });
});

/**
 * POST /api/v1/shipments/:id/documents: upload (metadata) against the checklist.
 * Any party organization member may upload; verification stays with the carrier.
 */
export const uploadDocument = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipper && !ctx.isCarrier && !ctx.isAgent) {
    return next(new AppError("Only shipment parties can upload documents.", forbidden));
  }
  if (["draft", "submitted", "completed", "cancelled"].includes(shipment.status)) {
    return next(
      new AppError("Documents can only be uploaded after quote approval and before closure.", badRequest),
    );
  }

  const { docType, fileName, fileUrl, expiresAt } = req.body;

  // Update the existing checklist row when present; otherwise add an extra doc.
  let document = await shipment_documents.findOne({
    where: { shipmentId: shipment.id, docType },
  });

  const uploadFields = {
    fileName,
    fileUrl,
    expiresAt: expiresAt || null,
    status: "uploaded",
    rejectionReason: null,
    uploadedByUserId: req.user.id,
    uploadedAt: new Date(),
    verifiedByUserId: null,
    verifiedAt: null,
  };

  if (document) {
    await document.update(uploadFields);
  } else {
    const catalogEntry = getDocumentType(docType);
    document = await shipment_documents.create({
      shipmentId: shipment.id,
      docType,
      label: catalogEntry?.label || docType,
      mandatory: false,
      ...uploadFields,
    });
  }

  await recordSystemEvent(shipment.id, "document_uploaded", {
    req,
    notes: `${document.label} (${fileName})`,
    metadata: { docType, fileName },
  });

  const documents = await loadDocuments(shipment.id);
  const gate = await syncDocumentPhase(shipment, documents, { req });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.UPLOAD_SHIPMENT_DOCUMENT,
    entityType: "shipment_documents",
    entityId: document.id,
    description: `Uploaded ${document.label} for ${shipment.reference}`,
    metadata: { docType, fileName },
  });

  return successResponse(res, created, { document, gate, shipmentStatus: shipment.status });
});

/**
 * PATCH /api/v1/shipments/documents/:docId/verify: carrier coordinator verifies.
 */
export const verifyDocument = catchAsync(async (req, res, next) => {
  const document = await shipment_documents.findByPk(req.params.docId);
  if (!document) return next(new AppError("Document not found.", notFound));

  const { shipment, ctx } = await getShipmentWithContext(document.shipmentId, req, { include: [] });
  if (!ctx.isCarrierCoordinator && !ctx.isAdmin) {
    return next(
      new AppError("Only the carrier's coordinators can verify documents.", forbidden),
    );
  }
  if (document.status !== "uploaded") {
    return next(new AppError("Only uploaded documents can be verified.", badRequest));
  }

  await document.update({
    status: "verified",
    verifiedByUserId: req.user.id,
    verifiedAt: new Date(),
  });

  await recordSystemEvent(shipment.id, "document_verified", {
    req,
    notes: document.label,
    metadata: { docType: document.docType },
  });

  const documents = await loadDocuments(shipment.id);
  const gate = await syncDocumentPhase(shipment, documents, { req });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.VERIFY_SHIPMENT_DOCUMENT,
    entityType: "shipment_documents",
    entityId: document.id,
    description: `Verified ${document.label} for ${shipment.reference}`,
    metadata: { docType: document.docType },
  });

  return successResponse(res, ok, { document, gate, shipmentStatus: shipment.status });
});

/**
 * PATCH /api/v1/shipments/documents/:docId/reject: carrier coordinator rejects
 * with a reason. A rejection can regress documents_complete → awaiting_documents.
 */
export const rejectDocument = catchAsync(async (req, res, next) => {
  const document = await shipment_documents.findByPk(req.params.docId);
  if (!document) return next(new AppError("Document not found.", notFound));

  const { shipment, ctx } = await getShipmentWithContext(document.shipmentId, req, { include: [] });
  if (!ctx.isCarrierCoordinator && !ctx.isAdmin) {
    return next(
      new AppError("Only the carrier's coordinators can reject documents.", forbidden),
    );
  }
  if (!["uploaded", "verified"].includes(document.status)) {
    return next(new AppError("Only uploaded or verified documents can be rejected.", badRequest));
  }

  await document.update({
    status: "rejected",
    rejectionReason: req.body.reason,
    verifiedByUserId: null,
    verifiedAt: null,
  });

  await recordSystemEvent(shipment.id, "document_rejected", {
    req,
    notes: `${document.label}: ${req.body.reason}`,
    metadata: { docType: document.docType, reason: req.body.reason },
  });

  const documents = await loadDocuments(shipment.id);
  const gate = await syncDocumentPhase(shipment, documents, { req });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.REJECT_SHIPMENT_DOCUMENT,
    entityType: "shipment_documents",
    entityId: document.id,
    description: `Rejected ${document.label} for ${shipment.reference}: ${req.body.reason}`,
    metadata: { docType: document.docType, reason: req.body.reason },
  });

  return successResponse(res, ok, { document, gate, shipmentStatus: shipment.status });
});
