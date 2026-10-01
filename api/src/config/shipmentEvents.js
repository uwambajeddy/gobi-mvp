"use strict";
/**
 * Structured operational event types: the shipment's operational diary.
 * Condensed from the commercial 34-type catalogue.
 *
 * `system` events are written automatically by platform actions.
 * `manual` events are recorded by coordinators, agents or drivers,
 * exactly the updates that arrive today via WhatsApp/phone. A future GPS or
 * customs integration would write the same events with source = "system".
 *
 * CommonJS so both sequelize-cli (plain node) and the Babel app can load it.
 */

const SYSTEM_EVENT_TYPES = [
  "shipment_created",
  "shipment_submitted",
  "carrier_assigned",
  "clearing_agent_assigned",
  "quote_approved",
  "document_uploaded",
  "document_verified",
  "document_rejected",
  "documents_complete",
  "execution_assigned",
  "gate_overridden",
  "payment_recorded",
  "exception_opened",
  "exception_resolved",
  "pod_captured",
  "shipment_completed",
  "shipment_cancelled",
];

/** Milestones recordable by hand from the operations workspace. */
const MANUAL_EVENT_TYPES = [
  "en_route_to_pickup",
  "picked_up",
  "departed_origin",
  "checkpoint",
  "fuel_stop",
  "border_approached",
  "border_cleared",
  "customs_submitted",
  "customs_released",
  "warehouse_arrived",
  "warehouse_released",
  "arrived_destination",
  "note_added",
  "other",
];

const EVENT_TYPES = [...SYSTEM_EVENT_TYPES, ...MANUAL_EVENT_TYPES];

/**
 * Events that advance the shipment lifecycle when recorded.
 * Everything else is pure timeline data.
 */
const EVENT_STATUS_EFFECTS = {
  picked_up: { from: ["execution_assigned"], to: "in_transit" },
  arrived_destination: { from: ["in_transit"], to: "arrived" },
};

const EVENT_LABELS = {
  shipment_created: "Shipment created",
  shipment_submitted: "Shipment submitted",
  carrier_assigned: "Transport company assigned",
  clearing_agent_assigned: "Clearing agent assigned",
  quote_approved: "Quotation approved",
  document_uploaded: "Document uploaded",
  document_verified: "Document verified",
  document_rejected: "Document rejected",
  documents_complete: "All mandatory documents complete",
  execution_assigned: "Vehicle & driver assigned",
  gate_overridden: "Gate overridden",
  payment_recorded: "Payment recorded",
  exception_opened: "Exception opened",
  exception_resolved: "Exception resolved",
  pod_captured: "Proof of delivery captured",
  shipment_completed: "Shipment completed",
  shipment_cancelled: "Shipment cancelled",
  en_route_to_pickup: "En route to pickup",
  picked_up: "Cargo picked up",
  departed_origin: "Departed origin",
  checkpoint: "Checkpoint passed",
  fuel_stop: "Fuel stop",
  border_approached: "Approaching border",
  border_cleared: "Border cleared",
  customs_submitted: "Customs declaration submitted",
  customs_released: "Customs released",
  warehouse_arrived: "Arrived at warehouse",
  warehouse_released: "Released from warehouse",
  arrived_destination: "Arrived at destination",
  note_added: "Note added",
  other: "Other",
};

module.exports = {
  SYSTEM_EVENT_TYPES,
  MANUAL_EVENT_TYPES,
  EVENT_TYPES,
  EVENT_STATUS_EFFECTS,
  EVENT_LABELS,
};
