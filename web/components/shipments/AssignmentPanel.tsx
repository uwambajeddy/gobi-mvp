"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { EmptyState } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { cn, fullName } from "@/lib/utils";
import {
  ComplianceGateResult,
  DocumentGateResult,
  DriverProfile,
  Membership,
  Shipment,
  ShipmentAccess,
  UserSummary,
  Vehicle,
} from "@/types";

interface MemberWithUser extends Membership {
  user?: UserSummary & { driverProfile?: DriverProfile };
}

function GateCard({
  title,
  passed,
  subtitle,
  failures,
  warnings,
}: {
  title: string;
  passed: boolean;
  subtitle?: string;
  failures: { key: string; text: string }[];
  warnings?: { key: string; text: string }[];
}) {
  return (
    <div
      className={cn(
        "rounded-inset border p-4",
        passed ? "border-success-line/70 bg-success-soft/70" : "border-danger-line/70 bg-danger-soft/70",
      )}
    >
      <div className="flex items-start gap-2.5">
        {passed ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-fg" aria-hidden />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger-fg" aria-hidden />
        )}
        <div className="min-w-0">
          <p className={cn("text-label font-semibold", passed ? "text-success-fg" : "text-danger-fg")}>
            {title}: {passed ? "PASSED" : "FAILED"}
          </p>
          {subtitle && <p className="text-caption text-ink-secondary">{subtitle}</p>}
        </div>
      </div>
      {failures.length > 0 && (
        <ul className="mt-2.5 space-y-1 pl-7 text-caption text-danger-fg">
          {failures.map((failure) => (
            <li key={failure.key} className="list-disc">
              {failure.text}
            </li>
          ))}
        </ul>
      )}
      {warnings && warnings.length > 0 && (
        <ul className="mt-2 space-y-1 pl-7 text-caption text-warning-fg">
          {warnings.map((warning) => (
            <li key={warning.key} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">Warning: </span>
                {warning.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Vehicle + driver assignment with live gate evaluation.
 * Failing gates block the assignment unless explicitly overridden with a
 * justification. The override is fully audited server-side.
 */
export function AssignmentPanel({
  shipment,
  access,
  onChanged,
}: {
  shipment: Shipment;
  access: ShipmentAccess;
  onChanged: () => void;
}) {
  const axios = useAxiosAuth();
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const canAssign =
    access.isCarrierCoordinator && ["awaiting_documents", "documents_complete"].includes(shipment.status);

  const { data: fleet, isLoading: fleetLoading } = useQuery({
    queryKey: ["fleet"],
    enabled: canAssign,
    queryFn: async () => (await axios.get("/api/v1/vehicles")).data.data.vehicles as Vehicle[],
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["org-members", shipment.transportOrgId],
    enabled: canAssign && Boolean(shipment.transportOrgId),
    queryFn: async () =>
      (await axios.get(`/api/v1/organizations/${shipment.transportOrgId}/members`)).data.data
        .members as MemberWithUser[],
  });

  const drivers = (members ?? []).filter((m) => m.role === "driver");

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ["assignment-preview", shipment.id, vehicleId, driverId],
    enabled: canAssign && Boolean(vehicleId) && Boolean(driverId),
    queryFn: async () =>
      (
        await axios.get(`/api/v1/shipments/${shipment.id}/assignment-preview`, {
          params: { vehicleId, driverId },
        })
      ).data.data as {
        documentGate: DocumentGateResult;
        complianceGate: ComplianceGateResult;
        cargoKg: number;
      },
  });

  const assign = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipment.id}/assign`, {
        vehicleId: Number(vehicleId),
        driverId: Number(driverId),
        ...(showOverride && {
          overrideDocumentGate: !preview?.documentGate.passed,
          overrideComplianceGate: !preview?.complianceGate.passed,
          overrideReason,
        }),
      }),
    onSuccess: () => {
      toast.success("Vehicle and driver assigned. Shipment ready to move.");
      onChanged();
    },
    onError: handleApiError,
  });

  // Already assigned, so show the pairing.
  if (shipment.assignedDriver || shipment.assignedVehicle) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              <Truck className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Execution assignment
            </CardTitle>
            <CardDescription>The vehicle and driver dispatched on this shipment.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-inset border border-line/70 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <UserRound className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-overline text-ink-muted">Driver</dt>
                <dd className="truncate text-label font-semibold text-ink">
                  {shipment.assignedDriver ? fullName(shipment.assignedDriver) : "-"}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-inset border border-line/70 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Truck className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-overline text-ink-muted">Vehicle</dt>
                <dd className="truncate text-label font-semibold text-ink">
                  {shipment.assignedVehicle
                    ? `${shipment.assignedVehicle.plateNumber} · ${shipment.assignedVehicle.model}`
                    : "-"}
                </dd>
              </div>
            </div>
          </dl>
          <Callout tone="neutral">
            Assignment decisions (including any gate overrides) are recorded on the timeline and in the
            platform audit log.
          </Callout>
        </CardContent>
      </Card>
    );
  }

  if (!canAssign) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="Assignment not available"
          description={
            ["draft", "submitted", "quote_approved"].includes(shipment.status)
              ? "Assignment opens once the quote is approved and the document checklist exists."
              : "Only the carrier's coordinators can assign a vehicle and driver."
          }
        />
      </Card>
    );
  }

  const gatesPassed = preview && preview.documentGate.passed && preview.complianceGate.passed;
  const needsOverride = preview && !gatesPassed;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Assign vehicle & driver</CardTitle>
          <CardDescription>
            Both gates are evaluated live as you choose, then checked again on the server.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Vehicle"
            hint={
              !fleetLoading && (fleet ?? []).length === 0 ? (
                <>
                  No vehicles registered.{" "}
                  <Link href="/dashboard/fleet" className="font-medium text-primary-600 hover:underline">
                    Add one in Fleet
                  </Link>
                </>
              ) : undefined
            }
          >
            <Select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={fleetLoading}>
              <option value="">{fleetLoading ? "Loading fleet..." : "Select vehicle..."}</option>
              {(fleet ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plateNumber} · {vehicle.model} ({vehicle.capacityKg?.toLocaleString()} kg)
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Driver"
            hint={
              !membersLoading && drivers.length === 0
                ? "No members of this carrier have the driver role."
                : undefined
            }
          >
            <Select value={driverId} onChange={(event) => setDriverId(event.target.value)} disabled={membersLoading}>
              <option value="">{membersLoading ? "Loading drivers..." : "Select driver..."}</option>
              {drivers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user?.firstName} {member.user?.lastName}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Live gate results */}
        {!vehicleId || !driverId ? (
          <Callout tone="neutral">Choose a vehicle and a driver to evaluate the document and compliance gates.</Callout>
        ) : previewLoading ? (
          <p className="flex items-center gap-2 text-body text-ink-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Evaluating gates...
          </p>
        ) : (
          preview && (
            <div className="grid gap-3 lg:grid-cols-2" aria-live="polite">
              <GateCard
                title="Document gate"
                passed={preview.documentGate.passed}
                failures={preview.documentGate.missing.map((doc) => ({
                  key: doc.docType,
                  text: `${doc.label}: ${doc.reason}`,
                }))}
              />
              <GateCard
                title="Compliance gate"
                passed={preview.complianceGate.passed}
                subtitle={`Cargo ${preview.cargoKg.toLocaleString()} kg`}
                failures={preview.complianceGate.failures.map((f) => ({ key: f.code, text: f.message }))}
                warnings={preview.complianceGate.warnings.map((w) => ({ key: w.code, text: w.message }))}
              />
            </div>
          )
        )}

        {/* Override */}
        {needsOverride && (
          <div className="rounded-inset border border-warning-line bg-warning-soft p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={showOverride}
                onChange={(event) => setShowOverride(event.target.checked)}
                className="checkbox mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1.5 text-label font-semibold text-warning-fg">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> Override failing gate(s)
                </span>
                <span className="mt-0.5 block text-caption text-warning-fg">
                  Overrides require a justification and are permanently recorded in the audit log with
                  the exact failures at dispatch time.
                </span>
              </span>
            </label>
            {showOverride && (
              <Field label="Override reason" hint="At least 5 characters." className="mt-3">
                <Input
                  placeholder="e.g. Insurance renewal receipt in hand; certificate issues Monday."
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                />
              </Field>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full sm:w-auto"
          disabled={
            !vehicleId ||
            !driverId ||
            !preview ||
            (!gatesPassed && (!showOverride || overrideReason.trim().length < 5))
          }
          loading={assign.isPending}
          onClick={() => assign.mutate()}
        >
          {assign.isPending
            ? "Assigning..."
            : needsOverride && showOverride
              ? "Assign with override"
              : "Assign vehicle & driver"}
        </Button>
      </CardFooter>
    </Card>
  );
}
