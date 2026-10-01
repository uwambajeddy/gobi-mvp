"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentStatusBadge } from "@/components/common/StatusBadge";
import { handleApiError } from "@/lib/handleApiError";
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentDocument } from "@/types";

/**
 * The required-documents checklist with upload (metadata), carrier
 * verification / rejection, and the live Document Gate result.
 */
export function DocumentsPanel({
  shipment,
  documents,
  access,
  onChanged,
}: {
  shipment: Shipment;
  documents: ShipmentDocument[];
  access: ShipmentAccess;
  onChanged: () => void;
}) {
  const axios = useAxiosAuth();
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const mandatory = documents.filter((doc) => doc.mandatory);
  const satisfied = mandatory.filter((doc) => ["uploaded", "verified"].includes(doc.status));
  const gatePassed = mandatory.length > 0 && satisfied.length === mandatory.length;

  const canUpload =
    (access.isShipper || access.isCarrier || access.isAgent) &&
    !["draft", "submitted", "completed", "cancelled"].includes(shipment.status);
  const canReview = access.isCarrierCoordinator || access.isAdmin;

  const upload = useMutation({
    mutationFn: async (docType: string) =>
      axios.post(`/api/v1/shipments/${shipment.id}/documents`, {
        docType,
        fileName,
        // Metadata-only upload: the file itself lives outside the MVP scope.
        fileUrl: `https://files.gobi.local/uploads/${encodeURIComponent(fileName)}`,
      }),
    onSuccess: () => {
      toast.success("Document uploaded.");
      setUploadFor(null);
      setFileName("");
      onChanged();
    },
    onError: handleApiError,
  });

  const verify = useMutation({
    mutationFn: async (docId: number) =>
      axios.patch(`/api/v1/shipments/documents/${docId}/verify`),
    onSuccess: () => {
      toast.success("Document verified.");
      onChanged();
    },
    onError: handleApiError,
  });

  const reject = useMutation({
    mutationFn: async (docId: number) =>
      axios.patch(`/api/v1/shipments/documents/${docId}/reject`, { reason: rejectionReason }),
    onSuccess: () => {
      toast.success("Document rejected. The checklist regressed.");
      setRejecting(null);
      setRejectionReason("");
      onChanged();
    },
    onError: handleApiError,
  });

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-mute">
          The document checklist is created when the quote is approved.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gate status */}
      <Card className={gatePassed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        <CardContent className="flex items-center gap-3 p-4">
          {gatePassed ? (
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
          ) : (
            <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
          )}
          <div>
            <p className={`text-sm font-semibold ${gatePassed ? "text-emerald-900" : "text-amber-900"}`}>
              Document gate: {gatePassed ? "PASSED" : "NOT SATISFIED"}
            </p>
            <p className={`text-xs ${gatePassed ? "text-emerald-700" : "text-amber-700"}`}>
              {satisfied.length} of {mandatory.length} mandatory documents in place.
              {!gatePassed && " Vehicle & driver assignment is blocked until the checklist is complete."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required documents</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 p-0">
          {documents.map((doc) => (
            <div key={doc.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-mute" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {doc.label}
                      {!doc.mandatory && (
                        <span className="ml-2 text-xs font-normal text-mute">(optional)</span>
                      )}
                    </p>
                    {doc.fileName && (
                      <p className="truncate text-xs text-mute">
                        {doc.fileName}
                        {doc.uploadedAt ? ` · uploaded ${formatDateTime(doc.uploadedAt)}` : ""}
                        {doc.expiresAt ? ` · expires ${doc.expiresAt}` : ""}
                      </p>
                    )}
                    {doc.status === "rejected" && doc.rejectionReason && (
                      <p className="mt-0.5 text-xs text-red-600">Rejected: {doc.rejectionReason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DocumentStatusBadge status={doc.status} />
                  {canUpload && ["required", "rejected"].includes(doc.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUploadFor(uploadFor === doc.docType ? null : doc.docType);
                        setFileName("");
                      }}
                    >
                      Upload
                    </Button>
                  )}
                  {canReview && doc.status === "uploaded" && (
                    <>
                      <Button size="sm" disabled={verify.isPending} onClick={() => verify.mutate(doc.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejecting(rejecting === doc.id ? null : doc.id)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {canReview && doc.status === "verified" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejecting(rejecting === doc.id ? null : doc.id)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>

              {uploadFor === doc.docType && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-gray-50 p-3">
                  <div className="min-w-64 flex-1 space-y-2">
                    <Label>File name</Label>
                    <Input
                      placeholder={`e.g. ${doc.docType.replace(/_/g, "-")}.pdf`}
                      value={fileName}
                      onChange={(event) => setFileName(event.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={fileName.trim().length < 3 || upload.isPending}
                    onClick={() => upload.mutate(doc.docType)}
                  >
                    {upload.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              )}

              {rejecting === doc.id && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-red-50 p-3">
                  <div className="min-w-64 flex-1 space-y-2">
                    <Label>Rejection reason</Label>
                    <Input
                      placeholder="e.g. Scan is illegible, please re-upload a clear copy."
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={rejectionReason.trim().length < 3 || reject.isPending}
                    onClick={() => reject.mutate(doc.id)}
                  >
                    Confirm rejection
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
