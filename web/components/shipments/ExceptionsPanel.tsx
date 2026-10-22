"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Plus, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { ExceptionStatusBadge, SeverityBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { EXCEPTION_TYPE_LABELS } from "@/lib/labels";
import { capitalize, cn, formatDateTime, fullName } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentException } from "@/types";

/**
 * Structured incident management: open exceptions block shipment completion.
 */
export function ExceptionsPanel({
  shipment,
  exceptions,
  access,
  onChanged,
}: {
  shipment: Shipment;
  exceptions: ShipmentException[];
  access: ShipmentAccess;
  onChanged: () => void;
}) {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("breakdown");
  const [severity, setSeverity] = useState("medium");
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // The workspace payload omits who opened/resolved each exception; the
  // dedicated endpoint includes them. Fall back to the payload while loading.
  const queryKey = ["shipment-exceptions", String(shipment.id)];
  const { data: detailed } = useQuery({
    queryKey,
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/exceptions`)).data.data.exceptions as ShipmentException[],
  });
  const list = detailed ?? exceptions;

  const canOpen = Boolean(access.can?.openException);
  const canResolve = access.isCarrierCoordinator || access.isAdmin;
  const openCount = list.filter((e) => e.status !== "resolved").length;

  const changed = () => {
    queryClient.invalidateQueries({ queryKey });
    onChanged();
  };

  const open = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipment.id}/exceptions`, { type, severity, notes }),
    onSuccess: () => {
      toast.success("Exception opened. Completion is blocked until it is resolved.");
      setFormOpen(false);
      setNotes("");
      changed();
    },
    onError: handleApiError,
  });

  const resolve = useMutation({
    mutationFn: async (exceptionId: number) =>
      axios.patch(`/api/v1/shipments/exceptions/${exceptionId}/resolve`, { resolutionNotes }),
    onSuccess: () => {
      toast.success("Exception resolved.");
      setResolving(null);
      setResolutionNotes("");
      changed();
    },
    onError: handleApiError,
  });

  return (
    <div className="space-y-5">
      {canOpen && (
        <Card>
          <CardHeader className={cn(!formOpen && "pb-5")}>
            <div>
              <CardTitle>
                <AlertTriangle className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Report an
                exception
              </CardTitle>
              <CardDescription>Breakdowns, holds, damage or anything that blocks normal progress.</CardDescription>
            </div>
            <Button variant={formOpen ? "ghost" : "default"} aria-expanded={formOpen} onClick={() => setFormOpen(!formOpen)}>
              {formOpen ? (
                <>
                  <X /> Close
                </>
              ) : (
                <>
                  <Plus /> Open exception
                </>
              )}
            </Button>
          </CardHeader>
          {formOpen && (
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Type">
                  <Select value={type} onChange={(event) => setType(event.target.value)}>
                    {Object.entries(EXCEPTION_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Severity">
                  <Select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                    {["low", "medium", "high", "critical"].map((level) => (
                      <option key={level} value={level}>
                        {capitalize(level)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="What happened?" hint="At least 3 characters.">
                <Textarea
                  placeholder="e.g. Gearbox failure 20km before Rusumo; mechanic dispatched."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={notes.trim().length < 3} loading={open.isPending} onClick={() => open.mutate()}>
                  {open.isPending ? "Opening..." : "Open exception"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {openCount > 0 && (
        <Callout tone="danger" title={`${openCount} open exception${openCount === 1 ? "" : "s"}`}>
          The shipment cannot be completed until every exception is resolved.
        </Callout>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Exceptions</CardTitle>
            <CardDescription>
              {list.length} recorded · {openCount} open
            </CardDescription>
          </div>
        </CardHeader>
        {list.length === 0 ? (
          <EmptyState
            compact
            icon={ShieldCheck}
            title="No exceptions"
            description="The shipment is running clean."
            className="border-t border-line/60"
          />
        ) : (
          <ul className="divide-y divide-line/60 border-t border-line/60">
            {list.map((exception) => {
              const resolved = exception.status === "resolved";
              return (
                <li key={exception.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]",
                          resolved ? "bg-success-soft text-success-fg" : "bg-danger-soft text-danger-fg",
                        )}
                      >
                        {resolved ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden />
                        ) : (
                          <AlertTriangle className="h-4 w-4" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-label font-semibold text-ink">
                          {EXCEPTION_TYPE_LABELS[exception.type] ?? exception.type}
                          <SeverityBadge severity={exception.severity} />
                          <ExceptionStatusBadge status={exception.status} />
                        </p>
                        <p className="mt-0.5 text-caption text-ink-muted">
                          Opened{exception.openedBy ? ` by ${fullName(exception.openedBy)}` : ""} ·{" "}
                          {formatDateTime(exception.createdAt)}
                        </p>
                        {exception.notes && <p className="mt-2 text-body text-ink-secondary">{exception.notes}</p>}
                      </div>
                    </div>
                    {canResolve && !resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        aria-expanded={resolving === exception.id}
                        onClick={() => setResolving(resolving === exception.id ? null : exception.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                  {resolved && exception.resolutionNotes && (
                    <div className="mt-3 rounded-inset border border-success-line/70 bg-success-soft p-3 sm:ml-12">
                      <p className="text-caption font-semibold text-success-fg">
                        Resolved{exception.resolvedBy ? ` by ${fullName(exception.resolvedBy)}` : ""} ·{" "}
                        {formatDateTime(exception.resolvedAt)}
                      </p>
                      <p className="mt-0.5 text-caption text-ink-secondary">{exception.resolutionNotes}</p>
                    </div>
                  )}
                  {resolving === exception.id && (
                    <div className="mt-3 flex flex-col gap-3 rounded-inset border border-line/70 bg-surface-muted p-3.5 sm:ml-12 md:flex-row md:items-start">
                      <Field label="Resolution notes" hint="At least 3 characters." className="md:flex-1">
                        <Input
                          placeholder="How was it resolved?"
                          value={resolutionNotes}
                          onChange={(event) => setResolutionNotes(event.target.value)}
                        />
                      </Field>
                      <div className="flex gap-2 md:mt-[1.625rem]">
                        <Button variant="ghost" onClick={() => setResolving(null)}>
                          Cancel
                        </Button>
                        <Button
                          disabled={resolutionNotes.trim().length < 3}
                          loading={resolve.isPending}
                          onClick={() => resolve.mutate(exception.id)}
                        >
                          Confirm resolution
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
