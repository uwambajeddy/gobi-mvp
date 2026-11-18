import { Badge } from "@/components/ui/badge";
import { SHIPMENT_STATUS_LABELS } from "@/lib/labels";
import { capitalize } from "@/lib/utils";
import { DocumentStatus, ExceptionStatus, PaymentStatus, ShipmentStatus } from "@/types";

type Variant = "secondary" | "info" | "warning" | "success" | "destructive" | "default";

export const shipmentStatusVariant: Record<ShipmentStatus, Variant> = {
  draft: "secondary",
  submitted: "info",
  quote_approved: "info",
  awaiting_documents: "warning",
  documents_complete: "default",
  execution_assigned: "default",
  in_transit: "info",
  arrived: "info",
  delivered: "success",
  completed: "success",
  cancelled: "destructive",
};

export function ShipmentStatusBadge({ status, className }: { status: ShipmentStatus; className?: string }) {
  return (
    <Badge dot variant={shipmentStatusVariant[status]} className={className}>
      {SHIPMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const documentVariants: Record<DocumentStatus, Variant> = {
  required: "secondary",
  uploaded: "info",
  verified: "success",
  rejected: "destructive",
};

// "required" is the API's state for "nothing uploaded yet"; it also applies
// to optional documents, so the label describes the state instead.
const documentLabels: Record<DocumentStatus, string> = {
  required: "Not uploaded",
  uploaded: "Uploaded",
  verified: "Verified",
  rejected: "Rejected",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge dot variant={documentVariants[status]}>
      {documentLabels[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge dot variant={status === "paid" ? "success" : "warning"}>
      {status === "paid" ? "Paid" : "Pending"}
    </Badge>
  );
}

const exceptionVariants: Record<ExceptionStatus, Variant> = {
  open: "destructive",
  investigating: "warning",
  resolved: "success",
};

export function ExceptionStatusBadge({ status }: { status: ExceptionStatus }) {
  return (
    <Badge dot variant={exceptionVariants[status]}>
      {capitalize(status)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const variant =
    severity === "critical" || severity === "high"
      ? "destructive"
      : severity === "medium"
        ? "warning"
        : "secondary";
  return <Badge variant={variant}>{capitalize(severity)} severity</Badge>;
}

export function DriverStatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  return (
    <Badge
      dot
      variant={status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning"}
    >
      {capitalize(status)}
    </Badge>
  );
}
