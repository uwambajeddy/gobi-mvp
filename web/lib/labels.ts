import { ShipmentStatus } from "@/types";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  quote_approved: "Quote approved",
  awaiting_documents: "Awaiting documents",
  documents_complete: "Documents complete",
  execution_assigned: "Execution assigned",
  in_transit: "In transit",
  arrived: "Arrived",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Ordered lifecycle (terminal cancelled excluded) for progress displays. */
export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
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
];

export const EVENT_LABELS: Record<string, string> = {
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

/** Milestones a user can record manually from the workspace. */
export const MANUAL_EVENT_TYPES = [
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

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  delivery_order: "Delivery order",
  port_fee: "Port fee",
  warehouse_fee: "Warehouse fee",
  border_fee: "Border fee",
  customs_duty: "Customs duty",
  road_user_charge: "Road user charge",
  other: "Other",
};

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  accident: "Accident",
  theft: "Theft",
  seal_tamper: "Seal tamper",
  customs_hold: "Customs hold",
  border_queue: "Border queue",
  cargo_damage: "Cargo damage",
  other: "Other",
};

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  distribution: "Distribution",
  transport: "Transport",
  clearing_agent: "Clearing agent",
};

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "commercial_invoice", label: "Commercial Invoice" },
  { value: "packing_list", label: "Packing List" },
  { value: "certificate_of_origin", label: "Certificate of Origin" },
  { value: "insurance_certificate", label: "Insurance Certificate" },
  { value: "import_declaration_form", label: "Import Declaration Form (IDF)" },
  { value: "duty_payment_receipt", label: "Duty Payment Receipt" },
  { value: "release_order", label: "Release Order" },
  { value: "comesa_yellow_card", label: "COMESA Yellow Card" },
  { value: "c2_transit_manifest", label: "C2 / Transit Manifest" },
  { value: "signed_delivery_note", label: "Signed Delivery Note" },
];
