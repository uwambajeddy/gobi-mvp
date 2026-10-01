"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, ShieldCheck, Truck } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/handleApiError";
import { formatDateTime } from "@/lib/utils";
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
    access.isCarrierCoordinator &&
    ["awaiting_documents", "documents_complete"].includes(shipment.status);

  const { data: fleet } = useQuery({
    queryKey: ["fleet"],
    enabled: canAssign,
    queryFn: async () => (await axios.get("/api/v1/vehicles")).data.data.vehicles as Vehicle[],
  });

  const { data: members } = useQuery({
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-primary" /> Execution assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-mute">Driver</dt>
              <dd className="mt-0.5 font-medium">
                {shipment.assignedDriver
                  ? `${shipment.assignedDriver.firstName} ${shipment.assignedDriver.lastName}`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-mute">Vehicle</dt>
              <dd className="mt-0.5 font-medium">
                {shipment.assignedVehicle
                  ? `${shipment.assignedVehicle.plateNumber} · ${shipment.assignedVehicle.model}`
                  : "-"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-mute">
            Assignment decisions (including any gate overrides) are recorded on the timeline and
            in the platform audit log.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canAssign) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-mute">
          {["draft", "submitted", "quote_approved"].includes(shipment.status)
            ? "Assignment opens once the quote is approved and the document checklist exists."
            : "Only the carrier's coordinators can assign a vehicle and driver."}
        </CardContent>
      </Card>
    );
  }

  const gatesPassed = preview && preview.documentGate.passed && preview.complianceGate.passed;
  const needsOverride = preview && !gatesPassed;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign vehicle & driver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <select
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Select vehicle...</option>
                {(fleet ?? []).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber} · {vehicle.model} ({vehicle.capacityKg?.toLocaleString()} kg)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Driver</Label>
              <select
                value={driverId}
                onChange={(event) => setDriverId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Select driver...</option>
                {drivers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user?.firstName} {member.user?.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live gate results */}
          {previewLoading && <p className="text-sm text-mute">Evaluating gates...</p>}
          {preview && (
            <div className="space-y-3">
              <div
                className={`rounded-md border p-3 ${
                  preview.documentGate.passed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {preview.documentGate.passed ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                  )}
                  Document gate: {preview.documentGate.passed ? "PASSED" : "FAILED"}
                </p>
                {!preview.documentGate.passed && (
                  <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-red-700">
                    {preview.documentGate.missing.map((doc) => (
                      <li key={doc.docType}>
                        {doc.label}: {doc.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className={`rounded-md border p-3 ${
                  preview.complianceGate.passed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {preview.complianceGate.passed ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                  )}
                  Compliance gate: {preview.complianceGate.passed ? "PASSED" : "FAILED"} · cargo{" "}
                  {preview.cargoKg.toLocaleString()} kg
                </p>
                {preview.complianceGate.failures.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-red-700">
                    {preview.complianceGate.failures.map((failure) => (
                      <li key={failure.code}>{failure.message}</li>
                    ))}
                  </ul>
                )}
                {preview.complianceGate.warnings.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-amber-700">
                    {preview.complianceGate.warnings.map((warning) => (
                      <li key={warning.code}>⚠ {warning.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Override */}
          {needsOverride && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={showOverride}
                  onChange={(event) => setShowOverride(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" /> Override failing gate(s)
                  </span>
                  <span className="block text-xs text-amber-700">
                    Overrides require a justification and are permanently recorded in the audit
                    log with the exact failures at dispatch time.
                  </span>
                </span>
              </label>
              {showOverride && (
                <div className="mt-3 space-y-2">
                  <Label>Override reason</Label>
                  <Input
                    placeholder="e.g. Insurance renewal receipt in hand; certificate issues Monday."
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={
              !vehicleId ||
              !driverId ||
              !preview ||
              assign.isPending ||
              (!gatesPassed && (!showOverride || overrideReason.trim().length < 5))
            }
            onClick={() => assign.mutate()}
          >
            {assign.isPending
              ? "Assigning..."
              : needsOverride && showOverride
                ? "Assign with override"
                : "Assign vehicle & driver"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
