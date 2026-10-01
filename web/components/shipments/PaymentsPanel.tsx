"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/common/StatusBadge";
import { handleApiError } from "@/lib/handleApiError";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentPayment } from "@/types";

/**
 * Operational payments ledger (port fees, customs duty, border fees),
 * each with an optional proof-of-payment document.
 */
export function PaymentsPanel({
  shipment,
  access,
}: {
  shipment: Shipment;
  access: ShipmentAccess;
}) {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("customs_duty");
  const [amount, setAmount] = useState("");
  const [proofFileName, setProofFileName] = useState("");

  const queryKey = ["shipment-payments", String(shipment.id)];

  const { data: payments, isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/payments`)).data.data
        .payments as ShipmentPayment[],
  });

  const canRecord = access.isCarrierCoordinator || access.isAgentCoordinator;

  const record = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipment.id}/payments`, {
        type,
        amount: Number(amount),
        ...(proofFileName && {
          proofFileName,
          proofUrl: `https://files.gobi.local/proofs/${encodeURIComponent(proofFileName)}`,
        }),
      }),
    onSuccess: () => {
      toast.success("Payment recorded.");
      setFormOpen(false);
      setAmount("");
      setProofFileName("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: handleApiError,
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

  const total = (payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-4">
      {canRecord && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" /> Record payment
            </CardTitle>
            <Button size="sm" variant={formOpen ? "ghost" : "default"} onClick={() => setFormOpen(!formOpen)}>
              {formOpen ? "Close" : "New payment"}
            </Button>
          </CardHeader>
          {formOpen && (
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="min-w-44 space-y-2">
                <Label>Type</Label>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-40 space-y-2">
                <Label>Amount (RWF)</Label>
                <Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
              <div className="min-w-56 flex-1 space-y-2">
                <Label>Proof file name (optional)</Label>
                <Input
                  placeholder="e.g. duty-receipt.pdf"
                  value={proofFileName}
                  onChange={(event) => setProofFileName(event.target.value)}
                />
              </div>
              <Button size="sm" disabled={!amount || record.isPending} onClick={() => record.mutate()}>
                {record.isPending ? "Recording..." : "Record"}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Ledger</CardTitle>
          <p className="text-sm font-semibold">{formatPrice(total)}</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-mute">Loading payments...</p>
          ) : (payments ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">No payments recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments!.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm font-medium">
                      {PAYMENT_TYPE_LABELS[payment.type] ?? payment.type}
                      {payment.notes && <p className="text-xs font-normal text-mute">{payment.notes}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatPrice(payment.amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {payment.proofFileName ? (
                        <span className="text-primary">{payment.proofFileName}</span>
                      ) : (
                        <span className="text-mute">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {payment.recordedBy
                        ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`
                        : "-"}
                      <p className="text-xs text-mute">{formatDateTime(payment.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canRecord && payment.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={markPaid.isPending}
                          onClick={() => markPaid.mutate(payment.id)}
                        >
                          Mark paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
