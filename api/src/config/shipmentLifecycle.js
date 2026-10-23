"use strict";

const SHIPMENT_STATUSES = [
  "draft",
  "submitted",
  "quote_approved",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
  "in_transit",
  "arrived",
  "delivered",
  "completed",
  "cancelled",
];

const ALLOWED_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["quote_approved", "cancelled"],
  quote_approved: ["awaiting_documents", "documents_complete", "cancelled"],
  awaiting_documents: ["documents_complete", "execution_assigned", "cancelled"],
  documents_complete: ["awaiting_documents", "execution_assigned", "cancelled"],
  execution_assigned: ["in_transit", "cancelled"],
  in_transit: ["arrived"],
  arrived: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

const CANCELLABLE_STATUSES = [
  "draft",
  "submitted",
  "quote_approved",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
];

const TERMINAL_STATUSES = SHIPMENT_STATUSES.filter((status) => ALLOWED_TRANSITIONS[status].length === 0);

const OPEN_STATUSES = SHIPMENT_STATUSES.filter((status) => !TERMINAL_STATUSES.includes(status));

const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from] || []).includes(to);

module.exports = {
  SHIPMENT_STATUSES,
  ALLOWED_TRANSITIONS,
  CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  OPEN_STATUSES,
  canTransition,
};
