import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { recordSystemEvent } from "../services/shipmentEvents.service";
import { notifyShipmentEvent } from "../services/notifications.service";
import { syncDocumentPhase } from "../services/documentGate.service";
import {
  describeAllowedActions,
  generateShipmentReference,
  getShipmentAccess,
  shipmentIncludes,
  shipmentScope,
} from "../services/shipmentAccess.service";
import { presentShipment } from "../services/shipmentVisibility.service";
import { checklistForShipment } from "../config/shipmentDocuments";
import db from "../database/models";

// Routes run `authorizeShipment(action)` first (config/shipmentPolicies), so
// handlers receive an authorized `req.shipment` in an allowed status.
const { ok, created, badRequest, notFound, conflict } = statusCodes;

/** A conditional update found the shipment no longer in the state it was read in. */
const shipmentChanged = () =>
  new AppError("This shipment changed while you were working on it. Reload it and try again.", conflict);
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
 * Admin sees all; drivers see their own assignments; everyone else sees
 * shipments where one of their organizations is a party (see shipmentScope).
 */
export const listShipments = catchAsync(async (req, res) => {
  const where = shipmentScope(req);
  if (req.query.status) where.status = req.query.status;

  const allShipments = await shipments.findAll({
    where,
    include: shipmentIncludes,
    order: [["updatedAt", "DESC"]],
  });

  return successResponse(res, ok, {
    shipments: allShipments.map((shipment) => presentShipment(shipment, getShipmentAccess(shipment, req))),
  });
});

/**
 * GET /api/v1/shipments/:id: full aggregate for the operations workspace.
 */
export const getShipment = catchAsync(async (req, res) => {
  const { shipment, access } = req;

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
    shipment: presentShipment(shipment, access),
    documents,
    exceptions,
    access: { ...access, can: describeAllowedActions(shipment, access) },
  });
});

/**
 * PATCH /api/v1/shipments/:id: shipper edits a draft.
 */
export const updateShipment = catchAsync(async (req, res) => {
  const { shipment } = req;

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
export const submitShipment = catchAsync(async (req, res) => {
  const { shipment } = req;

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
export const cancelShipment = catchAsync(async (req, res) => {
  const { shipment } = req;

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
 * A quote belongs to the carrier that gave it, so changing the carrier clears it.
 */
export const assignCarrier = catchAsync(async (req, res, next) => {
  const { shipment } = req;

  const carrier = await organizations.findOne({
    where: { id: req.body.transportOrgId, companyType: "transport" },
  });
  if (!carrier) {
    return next(new AppError("Transport organization not found.", notFound));
  }

  const previousTransportOrgId = shipment.transportOrgId;
  const carrierChanged = previousTransportOrgId !== carrier.id;
  const quoteCleared = carrierChanged && shipment.quoteAmount != null;

  const [updated] = await shipments.update(
    {
      transportOrgId: carrier.id,
      ...(carrierChanged && { quoteAmount: null, quoteCurrency: "RWF" }),
    },
    { where: { id: shipment.id, status: "submitted" } },
  );
  if (!updated) return next(shipmentChanged());
  await shipment.reload();

  const metadata = { transportOrgId: carrier.id, previousTransportOrgId, quoteCleared };
  await recordSystemEvent(shipment.id, "carrier_assigned", {
    req,
    notes: `Carrier: ${carrier.name}${quoteCleared ? " (previous carrier's quote cleared)" : ""}`,
    metadata,
  });
  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ASSIGN_CARRIER,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Assigned carrier ${carrier.name} to ${shipment.reference}`,
    metadata,
  });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/assign-clearing-agent
 */
export const assignClearingAgent = catchAsync(async (req, res, next) => {
  const { shipment } = req;

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
  const { shipment } = req;

  // Only while this carrier is still assigned, so a quote never lands on a
  // shipment that changed hands mid-request.
  const [updated] = await shipments.update(
    { quoteAmount: req.body.amount, quoteCurrency: req.body.currency || "RWF" },
    { where: { id: shipment.id, status: "submitted", transportOrgId: shipment.transportOrgId } },
  );
  if (!updated) return next(shipmentChanged());
  await shipment.reload();

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.SUBMIT_QUOTE,
    entityType: "shipments",
    entityId: shipment.id,
    description: `Quoted ${req.body.amount} ${req.body.currency || "RWF"} for ${shipment.reference}`,
    metadata: { amount: req.body.amount, currency: req.body.currency || "RWF" },
  });
  // A quote has no timeline event, so its email is queued here.
  notifyShipmentEvent("quote_submitted", { shipmentId: shipment.id, actorUserId: req.user.id });

  return successResponse(res, ok, { shipment });
});

/**
 * POST /api/v1/shipments/:id/approve-quote: shipper approves; the document
 * checklist is seeded and the shipment enters the documents phase.
 */
export const approveQuote = catchAsync(async (req, res, next) => {
  const { shipment } = req;

  if (!shipment.transportOrgId || shipment.quoteAmount == null) {
    return next(
      new AppError("A carrier must be assigned and a quote submitted before approval.", badRequest),
    );
  }

  // Approves exactly the quote and carrier the shipper was shown.
  const [updated] = await shipments.update(
    { status: "quote_approved", quoteApprovedAt: new Date() },
    {
      where: {
        id: shipment.id,
        status: "submitted",
        transportOrgId: shipment.transportOrgId,
        quoteAmount: shipment.quoteAmount,
        quoteCurrency: shipment.quoteCurrency,
      },
    },
  );
  if (!updated) return next(shipmentChanged());
  await shipment.reload();

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
export const capturePod = catchAsync(async (req, res) => {
  const { shipment } = req;

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

  // The assigned driver may capture POD, so the response follows their visibility.
  return successResponse(res, ok, { shipment: presentShipment(shipment, req.access) });
});

/**
 * POST /api/v1/shipments/:id/complete: shipper confirms receipt.
 * Closure rule: POD captured + no open exceptions.
 */
export const completeShipment = catchAsync(async (req, res, next) => {
  const { shipment } = req;

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
