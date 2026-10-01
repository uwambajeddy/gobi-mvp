import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { getShipmentWithContext, hasOrgRole } from "../services/shipmentAccess.service";
import db from "../database/models";

const { ok, created, notFound, forbidden, badRequest } = statusCodes;
const { shipment_payments, users } = db;

const recorderInclude = [
  { model: users, as: "recordedBy", attributes: ["id", "firstName", "lastName"] },
];

/**
 * GET /api/v1/shipments/:id/payments: the shipment's payment ledger.
 */
export const listPayments = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isParty) {
    return next(new AppError("You are not a party to this shipment.", forbidden));
  }

  const payments = await shipment_payments.findAll({
    where: { shipmentId: shipment.id },
    include: recorderInclude,
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { payments });
});

/**
 * POST /api/v1/shipments/:id/payments: record an operational payment
 * (port fee, customs duty, ...) with an optional proof document.
 */
export const recordPayment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req, { include: [] });

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isCarrierCoordinator && !ctx.isAgentCoordinator) {
    return next(
      new AppError(
        "Only carrier or clearing-agent coordinators can record payments.",
        forbidden,
      ),
    );
  }

  const { type, amount, currency, proofFileName, proofUrl, notes } = req.body;

  const payment = await shipment_payments.create({
    shipmentId: shipment.id,
    type,
    amount,
    currency: currency || "RWF",
    proofFileName,
    proofUrl,
    notes,
    recordedByUserId: req.user.id,
    status: proofUrl ? "paid" : "pending",
    paidAt: proofUrl ? new Date() : null,
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
    metadata: { type, amount, currency: currency || "RWF", hasProof: Boolean(proofUrl) },
  });

  const withRecorder = await shipment_payments.findByPk(payment.id, { include: recorderInclude });
  return successResponse(res, created, { payment: withRecorder });
});

/**
 * PATCH /api/v1/shipments/payments/:paymentId/mark-paid: attach proof / settle.
 */
export const markPaymentPaid = catchAsync(async (req, res, next) => {
  const payment = await shipment_payments.findByPk(req.params.paymentId);
  if (!payment) return next(new AppError("Payment not found.", notFound));

  const { shipment, ctx } = await getShipmentWithContext(payment.shipmentId, req, { include: [] });
  if (!ctx.isCarrierCoordinator && !ctx.isAgentCoordinator) {
    return next(
      new AppError("Only carrier or clearing-agent coordinators can settle payments.", forbidden),
    );
  }
  if (payment.status === "paid") {
    return next(new AppError("This payment is already marked as paid.", badRequest));
  }

  const { proofFileName, proofUrl } = req.body || {};

  await payment.update({
    status: "paid",
    paidAt: new Date(),
    ...(proofFileName && { proofFileName }),
    ...(proofUrl && { proofUrl }),
  });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.MARK_PAYMENT_PAID,
    entityType: "shipment_payments",
    entityId: payment.id,
    description: `Marked ${payment.type} payment as paid on ${shipment.reference}`,
    metadata: { hasProof: Boolean(payment.proofUrl) },
  });

  return successResponse(res, ok, { payment });
});
