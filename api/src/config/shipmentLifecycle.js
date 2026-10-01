"use strict";
/**
 * Shipment lifecycle, condensed from the commercial 18-status model.
 * Clearance, border operations and warehouse handling happen inside
 * `in_transit` and are tracked as structured shipment events.
 *
 * CommonJS so both sequelize-cli (plain node) and the Babel app can load it.
 */

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

/**
 * Allowed forward transitions. Document-gate syncing may also move a shipment
 * between `awaiting_documents` and `documents_complete` in both directions.
 */
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

/** Statuses in which the shipper may still cancel the shipment. */
const CANCELLABLE_STATUSES = [
  "draft",
  "submitted",
  "quote_approved",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
];

const canTransition = (from, to) => (ALLOWED_TRANSITIONS[from] || []).includes(to);

module.exports = {
  SHIPMENT_STATUSES,
  ALLOWED_TRANSITIONS,
  CANCELLABLE_STATUSES,
  canTransition,
};
