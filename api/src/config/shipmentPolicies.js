"use strict";

const { CANCELLABLE_STATUSES, OPEN_STATUSES } = require("./shipmentLifecycle");

const closedShipment = (what) => (status) => `${what} on a ${status} shipment.`;

const PARTY = ["isAdmin", "isShipper", "isCarrier", "isAgent", "isAssignedDriver"];

const OPERATIONAL_PARTY = ["isShipper", "isCarrier", "isAgent", "isAssignedDriver"];

const FINANCIAL_VIEWERS = ["isAdmin", "isShipper", "isCarrier", "isAgent"];

const OPERATIONAL_STATUSES = ["execution_assigned", "in_transit", "arrived", "delivered"];

const TRACKING_STATUSES = ["execution_assigned", "in_transit"];

const isTrackingActive = (shipment) =>
  TRACKING_STATUSES.includes(shipment.status) &&
  (shipment.status !== "execution_assigned" || Boolean(shipment.startTime));

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
  viewShipment: { actors: PARTY, denied: NOT_A_PARTY },
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

  listEvents: { actors: PARTY, denied: NOT_A_PARTY },
  recordEvent: {
    actors: OPERATIONAL_PARTY,
    stages: OPERATIONAL_STATUSES,
    denied: "Only shipment parties can record events.",
    wrongStage: "Operational events can only be recorded once a vehicle and driver are assigned.",
  },
  recordStatusMilestone: {
    actors: ["isCarrierCoordinator", "isAssignedDriver"],
    denied: "Only the carrier's coordinators or the assigned driver can record the driver's progress.",
  },

  viewTracking: { actors: PARTY, denied: NOT_A_PARTY },
  updateLocation: {
    actors: ["isAssignedDriver"],
    stages: TRACKING_STATUSES,
    when: isTrackingActive,
    denied: "Only the assigned driver can share the vehicle's location.",
    wrongStage: 'Location is shared from "Going to pickup" until arrival at the destination.',
  },

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

  listPayments: { actors: FINANCIAL_VIEWERS, denied: NO_PAYMENT_ACCESS },
  recordPayment: {
    actors: ["isCarrierCoordinator", "isAgentCoordinator"],
    stages: OPEN_STATUSES,
    denied: "Only carrier or clearing-agent coordinators can record payments.",
    wrongStage: closedShipment("Payments can't be recorded"),
  },
  markPaymentPaid: {
    actors: ["isCarrierCoordinator", "isAgentCoordinator"],
    denied: "Only carrier or clearing-agent coordinators can settle payments.",
  },
  attachPaymentProof: {
    actors: ["isCarrierCoordinator", "isAgentCoordinator"],
    denied: "Only carrier or clearing-agent coordinators can attach payment proof.",
  },
  viewPaymentProof: { actors: FINANCIAL_VIEWERS, denied: NO_PAYMENT_ACCESS },

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
  TRACKING_STATUSES,
  isTrackingActive,
};
