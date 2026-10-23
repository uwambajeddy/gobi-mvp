"use strict";
/**
 * Who may perform each shipment action, and in which statuses.
 *
 * `actors` names the access flags computed by `getShipmentAccess`
 * (services/shipmentAccess.service.js); any one of them is enough.
 * `stages` lists the statuses the action may run in; omitted means any.
 * `denied` / `wrongStage` are the messages returned with 403 / 400.
 *
 * Enforced by the `authorizeShipment` middleware on every shipment route,
 * and returned to the web app as `access.can` so the UI mirrors the API.
 *
 * CommonJS so both sequelize-cli (plain node) and the Babel app can load it.
 */

const { CANCELLABLE_STATUSES, OPEN_STATUSES } = require("./shipmentLifecycle");

/** Refusal for an action attempted on a completed or cancelled shipment. */
const closedShipment = (what) => (status) => `${what} on a ${status} shipment.`;

/** Every relationship that may read a shipment. */
const PARTY = ["isAdmin", "isShipper", "isCarrier", "isAgent", "isAssignedDriver"];

/** Organization members (not drivers) of the three party organizations, plus the assigned driver. */
const OPERATIONAL_PARTY = ["isShipper", "isCarrier", "isAgent", "isAssignedDriver"];

/**
 * Who may see money: quotes, payment amounts and proofs. The assigned
 * driver is deliberately absent; a driver needs the route, not the price.
 */
const FINANCIAL_VIEWERS = ["isAdmin", "isShipper", "isCarrier", "isAgent"];

/** Window in which manual operational milestones may be recorded. */
const OPERATIONAL_STATUSES = ["execution_assigned", "in_transit", "arrived", "delivered"];

/** Statuses in which documents may be uploaded: after quote approval, before closure. */
const DOCUMENT_UPLOAD_STATUSES = [
  "quote_approved",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
  "in_transit",
  "arrived",
  "delivered",
];

const NOT_A_PARTY = "You are not a party to this shipment.";
const NO_PAYMENT_ACCESS = "You don't have access to this shipment's payments.";

const SHIPMENT_POLICIES = {
  // ── Shipment ───────────────────────────────────────────────────────────────
  viewShipment: { actors: PARTY, denied: NOT_A_PARTY },
  // Quote fields and payment amounts in shipment, list and timeline responses.
  viewFinancials: {
    actors: FINANCIAL_VIEWERS,
    denied: "Quotes and payments are not shared with drivers.",
  },
  editDraft: {
    actors: ["isShipper"],
    stages: ["draft"],
    denied: "Only the shipper can edit this shipment.",
    wrongStage: "Only draft shipments can be edited.",
  },
  submitShipment: {
    actors: ["isShipper"],
    stages: ["draft"],
    denied: "Only the shipper can submit this shipment.",
    wrongStage: "Only draft shipments can be submitted.",
  },
  cancelShipment: {
    actors: ["isShipperCoordinator"],
    stages: CANCELLABLE_STATUSES,
    denied: "Only a shipper owner or coordinator can cancel this shipment.",
    wrongStage: (status) => `A shipment in status "${status}" can no longer be cancelled.`,
  },

  // ── Award ──────────────────────────────────────────────────────────────────
  assignCarrier: {
    actors: ["isShipperCoordinator"],
    stages: ["submitted"],
    denied: "Only a shipper owner or coordinator can assign a carrier.",
    wrongStage: "A carrier can only be assigned to a submitted shipment.",
  },
  assignClearingAgent: {
    actors: ["isShipperCoordinator"],
    stages: ["submitted", "quote_approved", "awaiting_documents"],
    denied: "Only a shipper owner or coordinator can assign a clearing agent.",
    wrongStage: "A clearing agent cannot be assigned at this stage of the shipment.",
  },
  submitQuote: {
    actors: ["isCarrierCoordinator"],
    stages: ["submitted"],
    denied: "Only the assigned carrier's coordinators can submit a quote.",
    wrongStage: "Quotes can only be submitted on a submitted shipment.",
  },
  approveQuote: {
    actors: ["isShipperCoordinator"],
    stages: ["submitted"],
    denied: "Only a shipper owner or coordinator can approve the quote.",
    wrongStage: "Only submitted shipments can have their quote approved.",
  },

  // ── Documents ──────────────────────────────────────────────────────────────
  listDocuments: { actors: PARTY, denied: NOT_A_PARTY },
  uploadDocument: {
    actors: OPERATIONAL_PARTY,
    stages: DOCUMENT_UPLOAD_STATUSES,
    denied: "Only shipment parties can upload documents.",
    wrongStage: "Documents can only be uploaded after quote approval and before closure.",
  },
  viewDocumentFile: { actors: PARTY, denied: NOT_A_PARTY },
  verifyDocument: {
    actors: ["isCarrierCoordinator", "isAdmin"],
    stages: OPEN_STATUSES,
    denied: "Only the carrier's coordinators can verify documents.",
    wrongStage: closedShipment("Documents can't be verified"),
  },
  rejectDocument: {
    actors: ["isCarrierCoordinator", "isAdmin"],
    stages: OPEN_STATUSES,
    denied: "Only the carrier's coordinators can reject documents.",
    wrongStage: closedShipment("Documents can't be rejected"),
  },

  // ── Operational assignment ─────────────────────────────────────────────────
  previewAssignment: {
    actors: ["isCarrierCoordinator", "isAdmin"],
    denied: "Only the carrier's coordinators can prepare assignments.",
  },
  assignExecution: {
    actors: ["isCarrierCoordinator"],
    stages: ["awaiting_documents", "documents_complete"],
    denied: "Only the carrier's coordinators can assign vehicle and driver.",
    wrongStage: "Vehicle and driver can only be assigned during the documents phase.",
  },

  // ── Timeline ───────────────────────────────────────────────────────────────
  listEvents: { actors: PARTY, denied: NOT_A_PARTY },
  recordEvent: {
    actors: OPERATIONAL_PARTY,
    stages: OPERATIONAL_STATUSES,
    denied: "Only shipment parties can record events.",
    wrongStage: "Operational events can only be recorded once a vehicle and driver are assigned.",
  },
  // Events that move the status (EVENT_STATUS_EFFECTS); checked on top of recordEvent.
  recordStatusMilestone: {
    actors: ["isCarrierCoordinator", "isAssignedDriver"],
    denied: "Only the carrier's coordinators or the assigned driver can record pickup and arrival.",
  },

  // ── POD & completion ───────────────────────────────────────────────────────
  capturePod: {
    actors: ["isCarrierCoordinator", "isAssignedDriver"],
    stages: ["arrived"],
    denied: "Only the carrier's coordinators or the assigned driver can capture POD.",
    wrongStage: "POD can only be captured once the shipment has arrived.",
  },
  completeShipment: {
    actors: ["isShipperCoordinator"],
    stages: ["delivered"],
    denied: "Only a shipper owner or coordinator can complete the shipment.",
    wrongStage: "Only delivered shipments can be completed.",
  },

  // ── Payments ───────────────────────────────────────────────────────────────
  listPayments: { actors: FINANCIAL_VIEWERS, denied: NO_PAYMENT_ACCESS },
  recordPayment: {
    actors: ["isCarrierCoordinator", "isAgentCoordinator"],
    stages: OPEN_STATUSES,
    denied: "Only carrier or clearing-agent coordinators can record payments.",
    wrongStage: closedShipment("Payments can't be recorded"),
  },
  // Settling stays open after closure: a fee incurred before completion or
  // cancellation may still be paid, and its proof filed, afterwards.
  markPaymentPaid: {
    actors: ["isCarrierCoordinator", "isAgentCoordinator"],
    denied: "Only carrier or clearing-agent coordinators can settle payments.",
  },
  attachPaymentProof: {
    actors: ["isCarrierCoordinator", "isAgentCoordinator"],
    denied: "Only carrier or clearing-agent coordinators can attach payment proof.",
  },
  viewPaymentProof: { actors: FINANCIAL_VIEWERS, denied: NO_PAYMENT_ACCESS },

  // ── Exceptions ─────────────────────────────────────────────────────────────
  listExceptions: { actors: PARTY, denied: NOT_A_PARTY },
  openException: {
    actors: OPERATIONAL_PARTY,
    stages: OPEN_STATUSES,
    denied: "Only shipment parties can open exceptions.",
    wrongStage: closedShipment("Exceptions can't be opened"),
  },
  resolveException: {
    actors: ["isCarrierCoordinator", "isAdmin"],
    denied: "Only the carrier's coordinators can resolve exceptions.",
  },
};

module.exports = {
  SHIPMENT_POLICIES,
  OPERATIONAL_STATUSES,
  DOCUMENT_UPLOAD_STATUSES,
};
