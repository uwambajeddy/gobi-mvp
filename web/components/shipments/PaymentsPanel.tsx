"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Receipt, Upload, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { PaymentStatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { StoredFileViewer } from "@/components/common/StoredFileViewer";
import { handleApiError } from "@/lib/handleApiError";
import { FILE_INPUT_ACCEPT, FILE_RULES_HINT, fileProblem, formatFileSize } from "@/lib/files";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { cn, formatDateTime, formatPrice, fullName } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentPayment } from "@/types";

// Overrides the client's JSON default; the browser adds the boundary.
const MULTIPART = { "Content-Type": "multipart/form-data" };

/**
 * Operational payments ledger (port fees, customs duty, border fees),
 * each with an optional proof-of-payment file stored privately.
 */
export function PaymentsPanel({ shipment, access }: { shipment: Shipment; access: ShipmentAccess }) {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("customs_duty");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string>();
  // Remounts the file input so a recorded payment clears the picked file.
  const [formKey, setFormKey] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const [attachFor, setAttachFor] = useState<number | null>(null);

  const queryKey = ["shipment-payments", String(shipment.id)];

  const {
    data: payments,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/payments`)).data.data.payments as ShipmentPayment[],
  });

  // New payments stop once the shipment is closed; existing ones can still be settled.
  const canRecord = Boolean(access.can?.recordPayment);
  const canSettle = Boolean(access.can?.markPaymentPaid);

  const chooseProof = (picked: File | null) => {
    const problem = picked ? fileProblem(picked) : undefined;
    setProof(problem ? null : picked);
    setProofError(problem);
  };

  const resetForm = () => {
    setAmount("");
    setProof(null);
    setProofError(undefined);
    setFormKey((key) => key + 1);
  };

  const record = useMutation({
    mutationFn: async () => {
      const url = `/api/v1/shipments/${shipment.id}/payments`;
      if (!proof) return axios.post(url, { type, amount: Number(amount) });
      const form = new FormData();
      form.append("type", type);
      form.append("amount", amount);
      form.append("file", proof);
      return axios.post(url, form, {
        headers: MULTIPART,
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
    },
    onSuccess: () => {
      toast.success(proof ? "Payment recorded as paid." : "Payment recorded.");
      setFormOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey });
    },
    onError: handleApiError,
    onSettled: () => setProgress(null),
  });

  const attach = useMutation({
    mutationFn: async ({ paymentId, file }: { paymentId: number; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return axios.post(`/api/v1/shipments/payments/${paymentId}/proof`, form, { headers: MULTIPART });
    },
    onSuccess: () => {
      toast.success("Proof attached. The payment is paid.");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: handleApiError,
    onSettled: () => setAttachFor(null),
  });

  const markPaid = useMutation({
    mutationFn: async (paymentId: number) =>
      axios.patch(`/api/v1/shipments/payments/${paymentId}/mark-paid`, {}),
    onSuccess: () => {
      toast.success("Payment marked as paid.");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: handleApiError,
  });

  const pickProofFor = (paymentId: number) => {
    setAttachFor(paymentId);
    if (attachInput.current) {
      attachInput.current.value = "";
      attachInput.current.click();
    }
  };

  const attachPicked = (picked: File | null) => {
    if (!picked || attachFor === null) return setAttachFor(null);
    const problem = fileProblem(picked);
    if (problem) {
      toast.error(problem);
      return setAttachFor(null);
    }
    attach.mutate({ paymentId: attachFor, file: picked });
  };

  const list = payments ?? [];
  const total = list.reduce((sum, payment) => sum + payment.amount, 0);
  const paid = list.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const viewing = list.find((payment) => payment.id === viewingId) ?? null;

  return (
    <div className="space-y-5">
      {canRecord && (
        <Card>
          <CardHeader className={cn(!formOpen && "pb-5")}>
            <div>
              <CardTitle>
                <Receipt className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Record a payment
              </CardTitle>
              <CardDescription>Port fees, customs duty, border fees and other corridor costs.</CardDescription>
            </div>
            <Button variant={formOpen ? "ghost" : "default"} aria-expanded={formOpen} onClick={() => setFormOpen(!formOpen)}>
              {formOpen ? (
                <>
                  <X /> Close
                </>
              ) : (
                <>
                  <Plus /> New payment
                </>
              )}
            </Button>
          </CardHeader>
          {formOpen && (
            <CardContent>
              <div className="grid gap-4 md:grid-cols-[12rem_10rem_minmax(0,1fr)]">
                <Field label="Type">
                  <Select value={type} onChange={(event) => setType(event.target.value)}>
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Amount (RWF)">
                  <Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
                </Field>
                <Field
                  label="Proof of payment"
                  optional
                  hint={
                    proof
                      ? `${proof.name} · ${formatFileSize(proof.size)}. The payment is recorded as paid.`
                      : `${FILE_RULES_HINT} With proof, the payment is recorded as paid.`
                  }
                  error={proofError}
                  className="min-w-0"
                >
                  <FileInput
                    key={formKey}
                    disabled={record.isPending}
                    onChange={(event) => chooseProof(event.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={record.isPending}
                  onClick={() => {
                    setFormOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button disabled={!amount} loading={record.isPending} onClick={() => record.mutate()}>
                  {record.isPending
                    ? proof
                      ? `Uploading${progress !== null ? ` ${progress}%` : "..."}`
                      : "Recording..."
                    : "Record payment"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>
              <Wallet className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Ledger
            </CardTitle>
            <CardDescription>A record of payments. It does not affect shipment closure.</CardDescription>
          </div>
          {list.length > 0 && (
            <div className="flex gap-5 text-right">
              <div>
                <p className="text-caption text-ink-muted">Paid</p>
                <p className="text-label font-semibold tabular-nums text-success-fg">{formatPrice(paid)}</p>
              </div>
              <div>
                <p className="text-caption text-ink-muted">Total</p>
                <p className="text-label font-semibold tabular-nums text-ink">{formatPrice(total)}</p>
              </div>
            </div>
          )}
        </CardHeader>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load payments" />
        ) : isLoading ? (
          <ListSkeleton rows={3} className="border-t border-line/60" />
        ) : list.length === 0 ? (
          <EmptyState compact icon={Receipt} title="No payments recorded" className="border-t border-line/60" />
        ) : (
          // A row list rather than a table so the actions never hide behind a horizontal scroll.
          <ul className="divide-y divide-line/60 border-t border-line/60">
            {list.map((payment) => {
              const attaching = attach.isPending && attach.variables?.paymentId === payment.id;
              return (
                <li
                  key={payment.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]",
                        payment.status === "paid" ? "bg-success-soft text-success-fg" : "bg-warning-soft text-warning-fg",
                      )}
                    >
                      <Receipt className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-label font-semibold text-ink">{PAYMENT_TYPE_LABELS[payment.type] ?? payment.type}</p>
                      <p className="text-caption text-ink-muted">
                        {payment.recordedBy ? `${fullName(payment.recordedBy)} · ` : ""}
                        {formatDateTime(payment.createdAt)}
                      </p>
                      {payment.hasProof ? (
                        <button
                          type="button"
                          onClick={() => setViewingId(payment.id)}
                          className="focus-ring mt-0.5 flex max-w-full items-center gap-1 rounded text-left text-caption font-medium text-primary-600 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{payment.proofFileName}</span>
                          <span className="shrink-0 font-normal text-ink-muted">{formatFileSize(payment.proofFileSize)}</span>
                        </button>
                      ) : (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-caption text-ink-secondary">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                          {payment.proofFileName ? (
                            <>
                              {payment.proofFileName}
                              <span className="text-ink-subtle"> · no file stored</span>
                            </>
                          ) : (
                            <span className="text-ink-subtle">No proof attached</span>
                          )}
                        </p>
                      )}
                      {payment.notes && <p className="mt-1 text-caption text-ink-muted">{payment.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12 sm:shrink-0 sm:justify-end sm:pl-0">
                    <span className="mr-1 text-label font-semibold tabular-nums text-ink">{formatPrice(payment.amount)}</span>
                    <PaymentStatusBadge status={payment.status} />
                    {canSettle && !payment.hasProof && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={attach.isPending}
                        loading={attaching}
                        onClick={() => pickProofFor(payment.id)}
                      >
                        {!attaching && <Upload />}
                        {attaching ? "Uploading..." : "Attach proof"}
                      </Button>
                    )}
                    {canSettle && payment.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={markPaid.isPending || attaching}
                        loading={markPaid.isPending && markPaid.variables === payment.id}
                        onClick={() => markPaid.mutate(payment.id)}
                      >
                        Mark paid
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* One hidden picker serves every row's "Attach proof" button; clicking it from code still opens the dialog. */}
      {canSettle && (
        <input
          ref={attachInput}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          hidden
          onChange={(event) => attachPicked(event.target.files?.[0] ?? null)}
        />
      )}

      {viewing && (
        <StoredFileViewer
          title={`${PAYMENT_TYPE_LABELS[viewing.type] ?? viewing.type} proof`}
          description={[viewing.proofFileName, formatFileSize(viewing.proofFileSize), formatPrice(viewing.amount)]
            .filter(Boolean)
            .join(" · ")}
          endpoint={`/api/v1/shipments/payments/${viewing.id}/proof`}
          cacheKey={["payment-proof", viewing.id, viewing.updatedAt]}
          onClose={() => setViewingId(null)}
        />
      )}
    </div>
  );
}
