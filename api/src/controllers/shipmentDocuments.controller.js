import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { evaluateDocumentGate, syncDocumentPhase } from "../services/documentGate.service";
import { getDocumentType } from "../config/shipmentDocuments";
import {
  cleanFileName,
  detectFileType,
  signedFileUrl,
  storageMode,
  storeFile,
} from "../services/fileStorage.service";
import db from "../database/models";

const { ok, created, badRequest, notFound, badGateway, serviceUnavailable } = statusCodes;
const { shipment_documents } = db;

const loadDocuments = (shipmentId) =>
  shipment_documents.findAll({ where: { shipmentId }, order: [["id", "ASC"]] });

export const listDocuments = catchAsync(async (req, res) => {
  const { shipment } = req;

  const documents = await loadDocuments(shipment.id);
  const gate = evaluateDocumentGate(documents);

  return successResponse(res, ok, { documents, gate });
});

export const uploadDocument = catchAsync(async (req, res, next) => {
  const { shipment } = req;

  if (!req.file) {
    return next(new AppError("Attach the document file (PDF, JPG or PNG).", badRequest));
  }
  if (!detectFileType(req.file.buffer)) {
    return next(new AppError("The file's content is not a PDF, JPG or PNG.", badRequest));
  }
  if (storageMode() === "disabled") {
    return next(new AppError("Document storage is not configured on this server.", serviceUnavailable));
  }

  const { docType, expiresAt } = req.body;
  const fileName = cleanFileName(req.file.originalname);

  let stored;
  try {
    stored = await storeFile(req.file, {
      folder: `gobi/${process.env.NODE_ENV || "development"}/shipments/${shipment.id}`,
    });
  } catch (error) {
    console.error("Document storage failed:", error.message);
    return next(new AppError("We couldn't store the file. Please try again.", badGateway));
  }

  let document = await shipment_documents.findOne({
    where: { shipmentId: shipment.id, docType },
  });

  const uploadFields = {
    fileName,
    fileUrl: null,
    fileKey: stored.key,
    fileResourceType: stored.resourceType,
    fileMimeType: stored.mimeType,
    fileSize: stored.size,
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

export const getDocumentFile = catchAsync(async (req, res, next) => {
  const { document } = req;

  if (!document.fileKey) {
    return next(new AppError("No file is stored for this document.", notFound));
  }

  const { url, expiresAt } = signedFileUrl(document);

  return successResponse(res, ok, {
    url,
    expiresAt,
    fileName: document.fileName,
    mimeType: document.fileMimeType,
    fileSize: document.fileSize,
  });
});

export const verifyDocument = catchAsync(async (req, res, next) => {
  const { shipment, document } = req;

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

export const rejectDocument = catchAsync(async (req, res, next) => {
  const { shipment, document } = req;

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
