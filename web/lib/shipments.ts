import { Shipment, ShipmentStatus } from "@/types";

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

/**
 * Live tracking runs from "Going to pickup" until arrival: in transit, and
 * before pickup once the driver has set off (mirrors the API's isTrackingActive).
 */
export const TRACKING_STATUSES: ShipmentStatus[] = ["execution_assigned", "in_transit"];

export const isTrackingActive = (shipment: Pick<Shipment, "status" | "startTime">) =>
  TRACKING_STATUSES.includes(shipment.status) &&
  (shipment.status !== "execution_assigned" || Boolean(shipment.startTime));

/**
 * The driver's progress milestones, in order: one button each (mirrors the
 * API's DRIVER_MILESTONES). Proof of delivery is the last step.
 */
export const DRIVER_MILESTONES = ["en_route_to_pickup", "arrived_pickup", "picked_up", "arrived_destination"];

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
      return shipment.startTime
        ? "The driver is on the way to pickup."
        : "Vehicle and driver assigned. Waiting for the driver to set off.";
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
