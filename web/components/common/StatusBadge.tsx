import { Badge } from "@/components/ui/badge";
import { SHIPMENT_STATUS_LABELS } from "@/lib/labels";
import { DocumentStatus, ExceptionStatus, PaymentStatus, ShipmentStatus } from "@/types";

const shipmentVariants: Record<
  ShipmentStatus,
  "secondary" | "info" | "warning" | "success" | "destructive" | "default"
> = {
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

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge variant={shipmentVariants[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>;
}

const documentVariants: Record<DocumentStatus, "secondary" | "info" | "success" | "destructive"> = {
  required: "secondary",
  uploaded: "info",
  verified: "success",
  rejected: "destructive",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant={documentVariants[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={status === "paid" ? "success" : "warning"}>
      {status === "paid" ? "Paid" : "Pending"}
    </Badge>
  );
}

const exceptionVariants: Record<ExceptionStatus, "destructive" | "warning" | "success"> = {
  open: "destructive",
  investigating: "warning",
  resolved: "success",
};

export function ExceptionStatusBadge({ status }: { status: ExceptionStatus }) {
  return (
    <Badge variant={exceptionVariants[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
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
  return <Badge variant={variant}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Badge>;
}
