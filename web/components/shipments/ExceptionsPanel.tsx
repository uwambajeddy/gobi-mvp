"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExceptionStatusBadge, SeverityBadge } from "@/components/common/StatusBadge";
import { handleApiError } from "@/lib/handleApiError";
import { EXCEPTION_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
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
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("breakdown");
  const [severity, setSeverity] = useState("medium");
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const canOpen = access.isShipper || access.isCarrier || access.isAgent || access.isAssignedDriver;
  const canResolve = access.isCarrierCoordinator || access.isAdmin;

  const open = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipment.id}/exceptions`, { type, severity, notes }),
    onSuccess: () => {
      toast.success("Exception opened. Completion is blocked until it is resolved.");
      setFormOpen(false);
      setNotes("");
      onChanged();
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
      onChanged();
    },
    onError: handleApiError,
  });

  return (
    <div className="space-y-4">
      {canOpen && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-primary" /> Report an exception
            </CardTitle>
            <Button size="sm" variant={formOpen ? "ghost" : "default"} onClick={() => setFormOpen(!formOpen)}>
              {formOpen ? "Close" : "Open exception"}
            </Button>
          </CardHeader>
          {formOpen && (
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {Object.entries(EXCEPTION_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <select
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {["low", "medium", "high", "critical"].map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>What happened?</Label>
                <Textarea
                  placeholder="e.g. Gearbox failure 20km before Rusumo; mechanic dispatched."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <Button
                size="sm"
                disabled={notes.trim().length < 3 || open.isPending}
                onClick={() => open.mutate()}
              >
                {open.isPending ? "Opening..." : "Open exception"}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exceptions ({exceptions.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 p-0">
          {exceptions.length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">
              No exceptions. The shipment is running clean.
            </p>
          ) : (
            exceptions.map((exception) => (
              <div key={exception.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {EXCEPTION_TYPE_LABELS[exception.type] ?? exception.type}
                      <SeverityBadge severity={exception.severity} />
                      <ExceptionStatusBadge status={exception.status} />
                    </p>
                    <p className="mt-0.5 text-xs text-mute">
                      Opened by {exception.openedBy?.firstName} {exception.openedBy?.lastName} ·{" "}
                      {formatDateTime(exception.createdAt)}
                    </p>
                  </div>
                  {canResolve && exception.status !== "resolved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResolving(resolving === exception.id ? null : exception.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
                {exception.notes && <p className="mt-2 text-sm text-body-text">{exception.notes}</p>}
                {exception.status === "resolved" && exception.resolutionNotes && (
                  <p className="mt-2 rounded-md bg-emerald-50 p-2.5 text-xs text-emerald-800">
                    Resolved by {exception.resolvedBy?.firstName} {exception.resolvedBy?.lastName}{" "}
                    ({formatDateTime(exception.resolvedAt)}): {exception.resolutionNotes}
                  </p>
                )}
                {resolving === exception.id && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-gray-50 p-3">
                    <div className="min-w-64 flex-1 space-y-2">
                      <Label>Resolution notes</Label>
                      <Input
                        placeholder="How was it resolved?"
                        value={resolutionNotes}
                        onChange={(event) => setResolutionNotes(event.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={resolutionNotes.trim().length < 3 || resolve.isPending}
                      onClick={() => resolve.mutate(exception.id)}
                    >
                      Confirm resolution
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
