import { Shipment, ShipmentStatus } from "@/types";

/** Statuses that count as "in progress" (not yet terminal and past draft). */
export const ACTIVE_STATUSES: ShipmentStatus[] = [
  "submitted",
  "quote_approved",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
  "in_transit",
  "arrived",
  "delivered",
];

/** Statuses where a party usually has to act next. */
export const ATTENTION_STATUSES: ShipmentStatus[] = [
  "submitted",
  "awaiting_documents",
  "arrived",
  "delivered",
];

/** Statuses from which the shipper can still cancel (mirrors the API). */
export const CANCELLABLE_STATUSES: ShipmentStatus[] = [
  "draft",
  "submitted",
  "quote_approved",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
];

/** Filterable statuses, in lifecycle order (quote_approved is transient). */
export const FILTER_STATUSES: ShipmentStatus[] = [
  "draft",
  "submitted",
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
 * Condensed lifecycle for progress displays. Each stage lists the statuses
 * that belong to it; quote approval and the document phase share a stage.
 */
export const LIFECYCLE_STAGES: { key: string; label: string; statuses: ShipmentStatus[] }[] = [
  { key: "draft", label: "Draft", statuses: ["draft"] },
  { key: "submitted", label: "Quotation", statuses: ["submitted"] },
  {
    key: "documents",
    label: "Documents",
    statuses: ["quote_approved", "awaiting_documents", "documents_complete"],
  },
  { key: "assigned", label: "Assigned", statuses: ["execution_assigned"] },
  { key: "in_transit", label: "In transit", statuses: ["in_transit"] },
  { key: "arrived", label: "Arrived", statuses: ["arrived"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
];

export const stageIndexOf = (status: ShipmentStatus) =>
  LIFECYCLE_STAGES.findIndex((stage) => stage.statuses.includes(status));

/**
 * One-line description of what the shipment is waiting for. Derived only
 * from fields the API returns, so it never claims more than the record says.
 */
export function nextStepHint(shipment: Shipment): string {
  switch (shipment.status) {
    case "draft":
      return "Draft. Submit it to start the quotation process.";
    case "submitted":
      if (!shipment.transportOrgId) return "Waiting for the shipper to assign a carrier.";
      if (shipment.quoteAmount == null) return "Waiting for the carrier's quote.";
      return "Quote received. Waiting for the shipper to approve it.";
    case "quote_approved":
    case "awaiting_documents":
      return "Mandatory documents are outstanding.";
    case "documents_complete":
      return "Documents complete. Ready for vehicle and driver assignment.";
    case "execution_assigned":
      return "Vehicle and driver assigned. Waiting for pickup.";
    case "in_transit":
      return "On the road. Milestones are recorded on the timeline.";
    case "arrived":
      return "Arrived at destination. Waiting for proof of delivery.";
    case "delivered":
      return "Delivered. Waiting for the shipper to confirm receipt.";
    case "completed":
      return "Completed and closed.";
    case "cancelled":
      return "This shipment was cancelled.";
    default:
      return "";
  }
}

export const cargoWeightKg = (shipment: Shipment) =>
  (shipment.packages ?? []).reduce((sum, pkg) => sum + pkg.weightKg * (pkg.quantity || 1), 0);

export const countByStatus = (shipments: Shipment[]) =>
  shipments.reduce<Partial<Record<ShipmentStatus, number>>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

/** Case-insensitive match against the fields a user would search by. */
export const matchesSearch = (shipment: Shipment, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    shipment.reference,
    shipment.title,
    shipment.originAddress,
    shipment.destinationAddress,
    shipment.distributionOrg?.name,
    shipment.transportOrg?.name,
    shipment.clearingAgentOrg?.name,
    shipment.recipientName,
  ]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(needle));
};
