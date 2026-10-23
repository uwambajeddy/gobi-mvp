import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import {
  cleanFileName,
  detectFileType,
  signedFileUrl,
  storageMode,
  storeFile,
} from "../services/fileStorage.service";
import db from "../database/models";

const { ok, created, notFound, badRequest, badGateway, serviceUnavailable } = statusCodes;
const { shipment_payments, users } = db;

const recorderInclude = [
  { model: users, as: "recordedBy", attributes: ["id", "firstName", "lastName"] },
];

const storeProof = async (file, shipmentId) => {
  if (!detectFileType(file.buffer)) {
    throw new AppError("The file's content is not a PDF, JPG or PNG.", badRequest);
  }
  if (storageMode() === "disabled") {
    throw new AppError("File storage is not configured on this server.", serviceUnavailable);
  }

  let stored;
  try {
    stored = await storeFile(file, {
      folder: `gobi/${process.env.NODE_ENV || "development"}/shipments/${shipmentId}/payments`,
    });
  } catch (error) {
    console.error("Payment proof storage failed:", error.message);
    throw new AppError("We couldn't store the file. Please try again.", badGateway);
  }

  return {
    proofFileName: cleanFileName(file.originalname, "proof"),
    proofUrl: null,
    proofFileKey: stored.key,
    proofResourceType: stored.resourceType,
    proofMimeType: stored.mimeType,
    proofFileSize: stored.size,
  };
};

export const listPayments = catchAsync(async (req, res) => {
  const { shipment } = req;

  const payments = await shipment_payments.findAll({
    where: { shipmentId: shipment.id },
    include: recorderInclude,
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { payments });
});

export const recordPayment = catchAsync(async (req, res) => {
  const { shipment } = req;
  const { type, amount, currency, notes } = req.body;
  const proof = req.file ? await storeProof(req.file, shipment.id) : null;

  const payment = await shipment_payments.create({
    shipmentId: shipment.id,
    type,
    amount,
    currency: currency || "RWF",
    notes,
    ...proof,
    recordedByUserId: req.user.id,
    status: proof ? "paid" : "pending",
    paidAt: proof ? new Date() : null,
  });

  await recordSystemEvent(shipment.id, "payment_recorded", {
    req,
    notes: `${type.replace(/_/g, " ")}: ${amount} ${currency || "RWF"}`,
    metadata: { paymentId: payment.id, type, amount },
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.RECORD_PAYMENT,
    entityType: "shipment_payments",
    entityId: payment.id,
    description: `Recorded ${type} payment of ${amount} ${currency || "RWF"} on ${shipment.reference}`,
    metadata: { type, amount, currency: currency || "RWF", hasProof: Boolean(proof) },
  });

  const withRecorder = await shipment_payments.findByPk(payment.id, { include: recorderInclude });
  return successResponse(res, created, { payment: withRecorder });
});

export const markPaymentPaid = catchAsync(async (req, res, next) => {
  const { shipment, payment } = req;

  if (payment.status === "paid") {
    return next(new AppError("This payment is already marked as paid.", badRequest));
  }

  await payment.update({ status: "paid", paidAt: new Date() });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.MARK_PAYMENT_PAID,
    entityType: "shipment_payments",
    entityId: payment.id,
    description: `Marked ${payment.type} payment as paid on ${shipment.reference}`,
    metadata: { hasProof: Boolean(payment.proofFileKey) },
  });

  return successResponse(res, ok, { payment });
});

export const attachPaymentProof = catchAsync(async (req, res, next) => {
  const { shipment, payment } = req;

  if (!req.file) {
    return next(new AppError("Attach the proof file (PDF, JPG or PNG).", badRequest));
  }

  const proof = await storeProof(req.file, shipment.id);
  const wasPending = payment.status === "pending";
  await payment.update({ ...proof, status: "paid", paidAt: payment.paidAt || new Date() });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.MARK_PAYMENT_PAID,
    entityType: "shipment_payments",
    entityId: payment.id,
    description: wasPending
      ? `Settled ${payment.type} payment with proof on ${shipment.reference}`
      : `Attached proof to ${payment.type} payment on ${shipment.reference}`,
    metadata: { hasProof: true, fileName: proof.proofFileName },
  });

  const withRecorder = await shipment_payments.findByPk(payment.id, { include: recorderInclude });
  return successResponse(res, ok, { payment: withRecorder });
});

export const getPaymentProof = catchAsync(async (req, res, next) => {
  const { payment } = req;

  if (!payment.proofFileKey) {
    return next(new AppError("No proof file is stored for this payment.", notFound));
  }

  const { url, expiresAt } = signedFileUrl({
    fileKey: payment.proofFileKey,
    fileResourceType: payment.proofResourceType,
    fileMimeType: payment.proofMimeType,
  });

  return successResponse(res, ok, {
    url,
    expiresAt,
    fileName: payment.proofFileName,
    mimeType: payment.proofMimeType,
    fileSize: payment.proofFileSize,
  });
});
