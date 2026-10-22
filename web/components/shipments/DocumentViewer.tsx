"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoredFileViewer } from "@/components/common/StoredFileViewer";
import { formatFileSize } from "@/lib/files";
import { formatDateTime } from "@/lib/utils";
import { ShipmentDocument } from "@/types";

/** Shows a stored document so it can be checked before it is verified. */
export function DocumentViewer({
  document,
  onClose,
  review,
}: {
  document: ShipmentDocument | null;
  onClose: () => void;
  /** Present when the viewer may verify or reject this document. */
  review?: { onVerify: () => void; onReject: () => void; verifying: boolean };
}) {
  if (!document) return null;

  const canReview = review && document.status === "uploaded";

  return (
    <StoredFileViewer
      title={document.label}
      description={[
        document.fileName,
        formatFileSize(document.fileSize),
        document.uploadedAt ? `uploaded ${formatDateTime(document.uploadedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      endpoint={`/api/v1/shipments/documents/${document.id}/file`}
      cacheKey={["document", document.id, document.uploadedAt]}
      enabled={Boolean(document.hasFile)}
      onClose={onClose}
      actions={
        canReview ? (
          <>
            <Button variant="destructive-outline" onClick={review.onReject}>
              Reject
            </Button>
            <Button loading={review.verifying} onClick={review.onVerify}>
              <CheckCircle2 /> Verify
            </Button>
          </>
        ) : undefined
      }
    />
  );
}
