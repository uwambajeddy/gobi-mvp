import { Op } from "sequelize";
import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { syncDocumentPhase } from "../services/documentGate.service";
import {
  getShipmentWithContext,
  generateShipmentReference,
  shipmentIncludes,
} from "../services/shipmentAccess.service";
import { checklistForShipment } from "../config/shipmentDocuments";
import { CANCELLABLE_STATUSES } from "../config/shipmentLifecycle";
import db from "../database/models";

const { ok, created, badRequest, notFound, forbidden } = statusCodes;
const {
  shipments,
  shipment_packages,
  shipment_documents,
  shipment_events,
  shipment_exceptions,
  organizations,
  users,
} = db;

/**
 * POST /api/v1/shipments: shipper creates a draft shipment with packages.
 */
export const createShipment = catchAsync(async (req, res) => {
  const {
    title,
    originAddress,
    destinationAddress,
    isCrossBorder,
    recipientName,
    recipientPhone,
    packages,
  } = req.body;

  const reference = await generateShipmentReference();

  const shipment = await shipments.create({
    reference,
    title,
    distributionOrgId: req.activeMembership.organizationId,
    createdByUserId: req.user.id,
    originAddress,
    destinationAddress,
    isCrossBorder,
    recipientName,
    recipientPhone,
    status: "draft",
  });

  await shipment_packages.bulkCreate(
    packages.map((pkg) => ({ ...pkg, shipmentId: shipment.id })),
  );

  await recordSystemEvent(shipment.id, "shipment_created", { req });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.CREATE_SHIPMENT,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Created shipment ${reference} (${title})`,
  });

  const withRelations = await shipments.findByPk(shipment.id, { include: shipmentIncludes });
  return successResponse(res, created, { shipment: withRelations });
});

/**
 * GET /api/v1/shipments: shipments visible to the caller.
 * Admin sees all; everyone else sees shipments where one of their
 * organizations is a party, or where they are the assigned driver.
 */
export const listShipments = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;

  if (req.user.type !== "admin") {
    const orgIds = (req.user.memberships || []).map((m) => m.organizationId);
    where[Op.or] = [
      { distributionOrgId: { [Op.in]: orgIds.length ? orgIds : [0] } },
      { transportOrgId: { [Op.in]: orgIds.length ? orgIds : [0] } },
      { clearingAgentOrgId: { [Op.in]: orgIds.length ? orgIds : [0] } },
      { assignedDriverId: req.user.id },
    ];
  }

  const allShipments = await shipments.findAll({
    where,
    include: shipmentIncludes,
    order: [["updatedAt", "DESC"]],
  });

  return successResponse(res, ok, { shipments: allShipments });
});

/**
 * GET /api/v1/shipments/:id: full aggregate for the operations workspace.
 */
export const getShipment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isParty) {
    return next(new AppError("You are not a party to this shipment.", forbidden));
  }

  const [documents, exceptions] = await Promise.all([
    shipment_documents.findAll({
      where: { shipmentId: shipment.id },
      order: [["id", "ASC"]],
    }),
    shipment_exceptions.findAll({
      where: { shipmentId: shipment.id },
      order: [["createdAt", "DESC"]],
    }),
  ]);

  return successResponse(res, ok, {
    shipment,
    documents,
    exceptions,
    access: ctx,
  });
});

/**
 * PATCH /api/v1/shipments/:id: shipper edits a draft.
 */
export const updateShipment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipper) {
    return next(new AppError("Only the shipper can edit this shipment.", forbidden));
  }
  if (shipment.status !== "draft") {
    return next(new AppError("Only draft shipments can be edited.", badRequest));
  }

  const { packages, ...fields } = req.body;
  await shipment.update(fields);

  if (packages) {
    await shipment_packages.destroy({ where: { shipmentId: shipment.id } });
    await shipment_packages.bulkCreate(
      packages.map((pkg) => ({ ...pkg, shipmentId: shipment.id })),
    );
  }

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.UPDATE_SHIPMENT,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Updated draft shipment ${shipment.reference}`,
  });

  const withRelations = await shipments.findByPk(shipment.id, { include: shipmentIncludes });
  return successResponse(res, ok, { shipment: withRelations });
});

/**
 * POST /api/v1/shipments/:id/submit: draft → submitted.
 */
export const submitShipment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipper) {
    return next(new AppError("Only the shipper can submit this shipment.", forbidden));
  }
  if (shipment.status !== "draft") {
    return next(new AppError("Only draft shipments can be submitted.", badRequest));
  }

  await shipment.update({ status: "submitted" });
  await recordSystemEvent(shipment.id, "shipment_submitted", { req });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.SUBMIT_SHIPMENT,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Submitted shipment ${shipment.reference}`,
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/cancel: shipper cancels before transit.
 */
export const cancelShipment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipperCoordinator) {
    return next(
      new AppError("Only a shipper owner or coordinator can cancel this shipment.", forbidden),
    );
  }
  if (!CANCELLABLE_STATUSES.includes(shipment.status)) {
    return next(
      new AppError(`A shipment in status "${shipment.status}" can no longer be cancelled.`, badRequest),
    );
  }

  await shipment.update({ status: "cancelled" });
  await recordSystemEvent(shipment.id, "shipment_cancelled", { req });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.CANCEL_SHIPMENT,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Cancelled shipment ${shipment.reference}`,
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/assign-carrier: shipper picks the transport company.
 */
export const assignCarrier = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipperCoordinator) {
    return next(new AppError("Only a shipper owner or coordinator can assign a carrier.", forbidden));
  }
  if (shipment.status !== "submitted") {
    return next(new AppError("A carrier can only be assigned to a submitted shipment.", badRequest));
  }

  const carrier = await organizations.findOne({
    where: { id: req.body.transportOrgId, companyType: "transport" },
  });
  if (!carrier) {
    return next(new AppError("Transport organization not found.", notFound));
  }

  await shipment.update({ transportOrgId: carrier.id });
  await recordSystemEvent(shipment.id, "carrier_assigned", {
    req,
    notes: `Carrier: ${carrier.name}`,
    metadata: { transportOrgId: carrier.id },
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ASSIGN_CARRIER,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Assigned carrier ${carrier.name} to ${shipment.reference}`,
    metadata: { transportOrgId: carrier.id },
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/assign-clearing-agent
 */
export const assignClearingAgent = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipperCoordinator) {
    return next(
      new AppError("Only a shipper owner or coordinator can assign a clearing agent.", forbidden),
    );
  }
  if (!["submitted", "quote_approved", "awaiting_documents"].includes(shipment.status)) {
    return next(
      new AppError("A clearing agent cannot be assigned at this stage of the shipment.", badRequest),
    );
  }

  const agent = await organizations.findOne({
    where: { id: req.body.clearingAgentOrgId, companyType: "clearing_agent" },
  });
  if (!agent) {
    return next(new AppError("Clearing agent organization not found.", notFound));
  }

  await shipment.update({ clearingAgentOrgId: agent.id });
  await recordSystemEvent(shipment.id, "clearing_agent_assigned", {
    req,
    notes: `Clearing agent: ${agent.name}`,
    metadata: { clearingAgentOrgId: agent.id },
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ASSIGN_CLEARING_AGENT,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Assigned clearing agent ${agent.name} to ${shipment.reference}`,
    metadata: { clearingAgentOrgId: agent.id },
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/quote: assigned carrier submits their quotation.
 */
export const submitQuote = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isCarrierCoordinator) {
    return next(
      new AppError("Only the assigned carrier's coordinators can submit a quote.", forbidden),
    );
  }
  if (shipment.status !== "submitted") {
    return next(new AppError("Quotes can only be submitted on a submitted shipment.", badRequest));
  }

  await shipment.update({
    quoteAmount: req.body.amount,
    quoteCurrency: req.body.currency || "RWF",
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.SUBMIT_QUOTE,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Quoted ${req.body.amount} ${req.body.currency || "RWF"} for ${shipment.reference}`,
    metadata: { amount: req.body.amount, currency: req.body.currency || "RWF" },
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/approve-quote: shipper approves; the document
 * checklist is seeded and the shipment enters the documents phase.
 */
export const approveQuote = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipperCoordinator) {
    return next(
      new AppError("Only a shipper owner or coordinator can approve the quote.", forbidden),
    );
  }
  if (shipment.status !== "submitted") {
    return next(new AppError("Only submitted shipments can have their quote approved.", badRequest));
  }
  if (!shipment.transportOrgId || shipment.quoteAmount == null) {
    return next(
      new AppError("A carrier must be assigned and a quote submitted before approval.", badRequest),
    );
  }

  await shipment.update({ status: "quote_approved", quoteApprovedAt: new Date() });
  await recordSystemEvent(shipment.id, "quote_approved", {
    req,
    metadata: { amount: shipment.quoteAmount, currency: shipment.quoteCurrency },
  });

  // Seed the required-documents checklist for this shipment.
  const checklist = checklistForShipment(shipment.isCrossBorder);
  await shipment_documents.bulkCreate(
    checklist.map((doc) => ({
      shipmentId: shipment.id,
      docType: doc.docType,
      label: doc.label,
      mandatory: doc.mandatory,
      status: "required",
    })),
  );

  // Immediately sync the documents phase (moves to awaiting_documents).
  const documents = await shipment_documents.findAll({ where: { shipmentId: shipment.id } });
  await syncDocumentPhase(shipment, documents, { req });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.APPROVE_QUOTE,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Approved quote of ${shipment.quoteAmount} ${shipment.quoteCurrency} for ${shipment.reference}`,
    metadata: { seededDocuments: checklist.map((d) => d.docType) },
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/pod: capture proof of delivery (arrived → delivered).
 */
export const capturePod = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isCarrierCoordinator && !ctx.isAssignedDriver) {
    return next(
      new AppError("Only the carrier's coordinators or the assigned driver can capture POD.", forbidden),
    );
  }
  if (shipment.status !== "arrived") {
    return next(new AppError("POD can only be captured once the shipment has arrived.", badRequest));
  }

  const { podRecipientName, podNotes } = req.body;

  await shipment.update({
    status: "delivered",
    podRecipientName,
    podNotes,
    podCapturedAt: new Date(),
  });
  await recordSystemEvent(shipment.id, "pod_captured", {
    req,
    notes: `Received by ${podRecipientName}`,
    metadata: { podRecipientName },
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.CAPTURE_POD,
    entityType: "shipments",
    entityId: shipment.id,
    description: `POD captured for ${shipment.reference}, received by ${podRecipientName}`,
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/complete: shipper confirms receipt.
 * Closure rule: POD captured + no open exceptions.
 */
export const completeShipment = catchAsync(async (req, res, next) => {
  const { shipment, ctx } = await getShipmentWithContext(req.params.id, req);

  if (!shipment) return next(new AppError("Shipment not found.", notFound));
  if (!ctx.isShipperCoordinator) {
    return next(
      new AppError("Only a shipper owner or coordinator can complete the shipment.", forbidden),
    );
  }
  if (shipment.status !== "delivered") {
    return next(new AppError("Only delivered shipments can be completed.", badRequest));
  }

  const openExceptions = await shipment_exceptions.count({
    where: { shipmentId: shipment.id, status: ["open", "investigating"] },
  });
  if (openExceptions > 0) {
    return next(
      new AppError(
        `Cannot complete: ${openExceptions} exception(s) are still open on this shipment.`,
        badRequest,
      ),
    );
  }

  await shipment.update({ status: "completed" });
  await recordSystemEvent(shipment.id, "shipment_completed", { req });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.COMPLETE_SHIPMENT,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Completed shipment ${shipment.reference}`,
  });

  return successResponse(res, ok, { shipment });
});
