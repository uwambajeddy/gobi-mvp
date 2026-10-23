"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Eye, FileClock, FileText, ShieldAlert, ShieldCheck, Upload, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { DocumentViewer } from "@/components/shipments/DocumentViewer";
import { Meter } from "@/components/ui/feedback";
import { DocumentStatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { FILE_RULES_HINT, fileProblem, formatFileSize } from "@/lib/files";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentDocument } from "@/types";

const docIconTone: Record<ShipmentDocument["status"], string> = {
  required: "bg-surface-sunken text-ink-muted",
  uploaded: "bg-info-soft text-info-fg",
  verified: "bg-success-soft text-success-fg",
  rejected: "bg-danger-soft text-danger-fg",
};

/**
 * The required-documents checklist with file upload, a viewer for checking
 * files, carrier verification / rejection, and the live Document Gate result.
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
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [progress, setProgress] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const mandatory = documents.filter((doc) => doc.mandatory);
  const satisfied = mandatory.filter((doc) => ["uploaded", "verified"].includes(doc.status));
  const gatePassed = mandatory.length > 0 && satisfied.length === mandatory.length;

  const canUpload = Boolean(access.can?.uploadDocument);
  // Verify and reject share one rule: carrier coordinators or admins, while the shipment is open.
  const canReview = Boolean(access.can?.verifyDocument);

  const viewing = documents.find((doc) => doc.id === viewingId) ?? null;

  const resetUpload = (docType: string | null) => {
    setUploadFor(docType);
    setFile(null);
    setFileError(undefined);
  };

  const chooseFile = (picked: File | null) => {
    const problem = picked ? fileProblem(picked) : undefined;
    setFile(problem ? null : picked);
    setFileError(problem);
  };

  const upload = useMutation({
    mutationFn: async (docType: string) => {
      const form = new FormData();
      form.append("docType", docType);
      form.append("file", file as File);
      return axios.post(`/api/v1/shipments/${shipment.id}/documents`, form, {
        // Overrides the client's JSON default; the browser adds the boundary.
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded.");
      resetUpload(null);
      onChanged();
    },
    onError: handleApiError,
    onSettled: () => setProgress(null),
  });

  const verify = useMutation({
    mutationFn: async (docId: number) => axios.patch(`/api/v1/shipments/documents/${docId}/verify`),
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
        <EmptyState
          icon={FileClock}
          title="No checklist yet"
          description="The document checklist is created when the quote is approved."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Gate status */}
      <Card
        className={cn(
          "p-5 sm:px-6",
          gatePassed ? "border-success-line bg-success-soft/60" : "border-warning-line bg-warning-soft/60",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem]",
              gatePassed ? "bg-success-soft text-success-fg" : "bg-warning-soft text-warning-fg",
            )}
          >
            {gatePassed ? <ShieldCheck className="h-5 w-5" aria-hidden /> : <ShieldAlert className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={cn("text-label font-semibold", gatePassed ? "text-success-fg" : "text-warning-fg")}>
                Document gate: {gatePassed ? "PASSED" : "NOT SATISFIED"}
              </p>
              <p className="text-label tabular-nums text-ink">
                {satisfied.length} of {mandatory.length} mandatory
              </p>
            </div>
            <Meter
              className="mt-2"
              value={satisfied.length}
              max={mandatory.length}
              tone={gatePassed ? "success" : "warning"}
              label="Mandatory documents in place"
            />
            <p className="mt-2 text-caption text-ink-secondary">
              {gatePassed
                ? "Every mandatory document is uploaded or verified."
                : "Vehicle & driver assignment is blocked until the checklist is complete."}
            </p>
          </div>
        </div>
      </Card>

      {/* Checklist */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>
              <FileText className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Required documents
            </CardTitle>
            <CardDescription>
              {shipment.isCrossBorder ? "Cross-border checklist" : "Domestic checklist"} · files are stored
              privately and open only for shipment parties.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="divide-y divide-line/60 border-t border-line/60">
          {documents.map((doc) => (
            <li key={doc.id} className="px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]",
                      docIconTone[doc.status],
                    )}
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-label font-semibold text-ink">
                      {doc.label}
                      {doc.mandatory ? (
                        <Badge variant="outline" className="py-0 text-[0.6875rem]">
                          Mandatory
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="py-0 text-[0.6875rem]">
                          Optional
                        </Badge>
                      )}
                    </p>
                    {doc.fileName ? (
                      <p className="mt-0.5 truncate text-caption text-ink-muted">
                        {doc.fileName}
                        {doc.hasFile ? ` · ${formatFileSize(doc.fileSize)}` : " · no file stored"}
                        {doc.uploadedAt ? ` · uploaded ${formatDateTime(doc.uploadedAt)}` : ""}
                        {doc.expiresAt ? ` · expires ${formatDate(doc.expiresAt)}` : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-caption text-ink-subtle">Nothing uploaded yet</p>
                    )}
                    {doc.status === "rejected" && doc.rejectionReason && (
                      <p className="mt-1 flex items-start gap-1 text-caption font-medium text-danger-fg">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Rejected: {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-12 sm:shrink-0 sm:flex-nowrap sm:pl-0">
                  <DocumentStatusBadge status={doc.status} />
                  {doc.hasFile && (
                    <Button size="sm" variant="outline" onClick={() => setViewingId(doc.id)}>
                      <Eye /> View
                    </Button>
                  )}
                  {canUpload && ["required", "rejected"].includes(doc.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-expanded={uploadFor === doc.docType}
                      onClick={() => resetUpload(uploadFor === doc.docType ? null : doc.docType)}
                    >
                      <Upload /> Upload
                    </Button>
                  )}
                  {canReview && doc.status === "uploaded" && (
                    <>
                      <Button size="sm" loading={verify.isPending && verify.variables === doc.id} disabled={verify.isPending} onClick={() => verify.mutate(doc.id)}>
                        <CheckCircle2 /> Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        aria-expanded={rejecting === doc.id}
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
                      aria-expanded={rejecting === doc.id}
                      onClick={() => setRejecting(rejecting === doc.id ? null : doc.id)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>

              {uploadFor === doc.docType && (
                <div className="mt-3 flex flex-col gap-3 rounded-inset border border-line/70 bg-surface-muted p-3.5 sm:ml-12 md:flex-row md:items-start">
                  <Field
                    label="File"
                    hint={file ? `${file.name} · ${formatFileSize(file.size)}` : FILE_RULES_HINT}
                    error={fileError}
                    className="min-w-0 md:flex-1"
                  >
                    <FileInput
                      disabled={upload.isPending}
                      onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                    />
                  </Field>
                  <div className="flex gap-2 md:mt-[1.625rem]">
                    <Button variant="ghost" disabled={upload.isPending} onClick={() => resetUpload(null)}>
                      Cancel
                    </Button>
                    <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate(doc.docType)}>
                      {upload.isPending ? `Uploading${progress !== null ? ` ${progress}%` : "..."}` : "Upload"}
                    </Button>
                  </div>
                </div>
              )}

              {rejecting === doc.id && (
                <div className="mt-3 flex flex-col gap-3 rounded-inset border border-danger-line/70 bg-danger-soft/60 p-3.5 sm:ml-12 md:flex-row md:items-start">
                  <Field label="Rejection reason" hint="Min. 3 characters. Shared with every party." className="md:flex-1">
                    <Input
                      placeholder="e.g. Scan is illegible, please re-upload a clear copy."
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                    />
                  </Field>
                  <div className="flex gap-2 md:mt-[1.625rem]">
                    <Button variant="ghost" onClick={() => setRejecting(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={rejectionReason.trim().length < 3}
                      loading={reject.isPending}
                      onClick={() => reject.mutate(doc.id)}
                    >
                      Confirm rejection
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <DocumentViewer
        document={viewing}
        onClose={() => setViewingId(null)}
        review={
          canReview && viewing
            ? {
                verifying: verify.isPending,
                onVerify: () => verify.mutate(viewing.id, { onSuccess: () => setViewingId(null) }),
                onReject: () => {
                  setViewingId(null);
                  setRejecting(viewing.id);
                },
              }
            : undefined
        }
      />
    </div>
  );
}
