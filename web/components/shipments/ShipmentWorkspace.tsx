"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Globe, MapPin, Phone, Truck, User as UserIcon } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { TimelinePanel } from "@/components/shipments/TimelinePanel";
import { DocumentsPanel } from "@/components/shipments/DocumentsPanel";
import { AssignmentPanel } from "@/components/shipments/AssignmentPanel";
import { PaymentsPanel } from "@/components/shipments/PaymentsPanel";
import { ExceptionsPanel } from "@/components/shipments/ExceptionsPanel";
import { handleApiError } from "@/lib/handleApiError";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import {
  Organization,
  Shipment,
  ShipmentAccess,
  ShipmentDocument,
  ShipmentException,
} from "@/types";

type Tab = "timeline" | "documents" | "assignment" | "payments" | "exceptions";

interface WorkspaceData {
  shipment: Shipment;
  documents: ShipmentDocument[];
  exceptions: ShipmentException[];
  access: ShipmentAccess;
}

/** Inline action form for assigning a carrier / clearing agent from the directory. */
function AssignPartyForm({
  shipmentId,
  kind,
  onDone,
}: {
  shipmentId: number;
  kind: "carrier" | "agent";
  onDone: () => void;
}) {
  const axios = useAxiosAuth();
  const [orgId, setOrgId] = useState("");

  const companyType = kind === "carrier" ? "transport" : "clearing_agent";

  const { data: orgs } = useQuery({
    queryKey: ["org-directory", companyType],
    queryFn: async () =>
      (await axios.get("/api/v1/organizations", { params: { companyType } })).data.data
        .organizations as Organization[],
  });

  const assign = useMutation({
    mutationFn: async () =>
      axios.post(
        `/api/v1/shipments/${shipmentId}/assign-${kind === "carrier" ? "carrier" : "clearing-agent"}`,
        kind === "carrier"
          ? { transportOrgId: Number(orgId) }
          : { clearingAgentOrgId: Number(orgId) },
      ),
    onSuccess: () => {
      toast.success(kind === "carrier" ? "Carrier assigned." : "Clearing agent assigned.");
      onDone();
    },
    onError: handleApiError,
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 space-y-2">
        <Label>{kind === "carrier" ? "Transport company" : "Clearing agent"}</Label>
        <select
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Select organization...</option>
          {(orgs ?? []).map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      <Button size="sm" disabled={!orgId || assign.isPending} onClick={() => assign.mutate()}>
        Assign
      </Button>
    </div>
  );
}

/** Inline quote form for the carrier. */
function QuoteForm({ shipmentId, onDone }: { shipmentId: number; onDone: () => void }) {
  const axios = useAxiosAuth();
  const [amount, setAmount] = useState("");

  const quote = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipmentId}/quote`, { amount: Number(amount) }),
    onSuccess: () => {
      toast.success("Quote submitted.");
      onDone();
    },
    onError: handleApiError,
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48 space-y-2">
        <Label>Quote amount (RWF)</Label>
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <Button size="sm" disabled={!amount || quote.isPending} onClick={() => quote.mutate()}>
        Submit quote
      </Button>
    </div>
  );
}

/** Inline POD capture form. */
function PodForm({ shipmentId, onDone }: { shipmentId: number; onDone: () => void }) {
  const axios = useAxiosAuth();
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");

  const capture = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipmentId}/pod`, {
        podRecipientName: recipient,
        podNotes: notes,
      }),
    onSuccess: () => {
      toast.success("Proof of delivery captured.");
      onDone();
    },
    onError: handleApiError,
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-52 space-y-2">
        <Label>Received by</Label>
        <Input
          placeholder="Recipient name"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
        />
      </div>
      <div className="min-w-64 flex-1 space-y-2">
        <Label>Notes (condition, remarks)</Label>
        <Input
          placeholder="e.g. Received in full, no damages"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <Button
        size="sm"
        disabled={recipient.trim().length < 2 || capture.isPending}
        onClick={() => capture.mutate()}
      >
        Capture POD
      </Button>
    </div>
  );
}

/** Status + role driven lifecycle actions. */
function LifecycleActions({ data, onChanged }: { data: WorkspaceData; onChanged: () => void }) {
  const axios = useAxiosAuth();
  const { shipment, access } = data;
  const [openForm, setOpenForm] = useState<string | null>(null);

  const simpleAction = useMutation({
    mutationFn: async (path: string) => axios.post(`/api/v1/shipments/${shipment.id}/${path}`),
    onSuccess: (_, path) => {
      toast.success(
        path === "submit"
          ? "Shipment submitted."
          : path === "approve-quote"
            ? "Quote approved. Document checklist created."
            : path === "complete"
              ? "Shipment completed."
              : "Shipment cancelled.",
      );
      onChanged();
    },
    onError: handleApiError,
  });

  const actions: { key: string; label: string; variant?: "default" | "outline" | "destructive"; run?: () => void }[] = [];

  if (access.isShipper && shipment.status === "draft") {
    actions.push({ key: "submit", label: "Submit shipment", run: () => simpleAction.mutate("submit") });
  }
  if (access.isShipperCoordinator && shipment.status === "submitted" && !shipment.transportOrgId) {
    actions.push({ key: "assign-carrier", label: "Assign carrier", variant: "outline" });
  }
  if (
    access.isShipperCoordinator &&
    ["submitted", "quote_approved", "awaiting_documents"].includes(shipment.status) &&
    !shipment.clearingAgentOrgId &&
    shipment.isCrossBorder
  ) {
    actions.push({ key: "assign-agent", label: "Assign clearing agent", variant: "outline" });
  }
  if (access.isCarrierCoordinator && shipment.status === "submitted") {
    actions.push({ key: "quote", label: shipment.quoteAmount ? "Update quote" : "Submit quote", variant: "outline" });
  }
  if (
    access.isShipperCoordinator &&
    shipment.status === "submitted" &&
    shipment.transportOrgId &&
    shipment.quoteAmount != null
  ) {
    actions.push({
      key: "approve-quote",
      label: `Approve quote (${formatPrice(shipment.quoteAmount)})`,
      run: () => simpleAction.mutate("approve-quote"),
    });
  }
  if ((access.isCarrierCoordinator || access.isAssignedDriver) && shipment.status === "arrived") {
    actions.push({ key: "pod", label: "Capture POD" });
  }
  if (access.isShipperCoordinator && shipment.status === "delivered") {
    actions.push({ key: "complete", label: "Confirm receipt & complete", run: () => simpleAction.mutate("complete") });
  }
  if (
    access.isShipperCoordinator &&
    ["draft", "submitted", "quote_approved", "awaiting_documents", "documents_complete", "execution_assigned"].includes(
      shipment.status,
    )
  ) {
    actions.push({
      key: "cancel",
      label: "Cancel shipment",
      variant: "destructive",
      run: () => {
        if (confirm("Cancel this shipment? This cannot be undone.")) simpleAction.mutate("cancel");
      },
    });
  }

  if (actions.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {actions.map(({ key, label, variant, run }) => (
            <Button
              key={key}
              size="sm"
              variant={variant ?? "default"}
              disabled={simpleAction.isPending}
              onClick={() => (run ? run() : setOpenForm(openForm === key ? null : key))}
            >
              {label}
            </Button>
          ))}
        </div>
        {openForm === "assign-carrier" && (
          <AssignPartyForm shipmentId={shipment.id} kind="carrier" onDone={() => { setOpenForm(null); onChanged(); }} />
        )}
        {openForm === "assign-agent" && (
          <AssignPartyForm shipmentId={shipment.id} kind="agent" onDone={() => { setOpenForm(null); onChanged(); }} />
        )}
        {openForm === "quote" && (
          <QuoteForm shipmentId={shipment.id} onDone={() => { setOpenForm(null); onChanged(); }} />
        )}
        {openForm === "pod" && (
          <PodForm shipmentId={shipment.id} onDone={() => { setOpenForm(null); onChanged(); }} />
        )}
      </CardContent>
    </Card>
  );
}

export default function ShipmentWorkspace({ id }: { id: string }) {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("timeline");

  const { data, isLoading } = useQuery({
    queryKey: ["shipment", id],
    queryFn: async () => (await axios.get(`/api/v1/shipments/${id}`)).data.data as WorkspaceData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["shipment", id] });
    queryClient.invalidateQueries({ queryKey: ["shipment-events", id] });
    queryClient.invalidateQueries({ queryKey: ["shipments"] });
  };

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-mute">Loading shipment...</p>;
  }
  if (!data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-mute">Shipment not found or you are not a party to it.</p>
        <Button variant="link" asChild>
          <Link href="/dashboard/shipments">Back to shipments</Link>
        </Button>
      </div>
    );
  }

  const { shipment, documents, exceptions, access } = data;
  const openExceptions = exceptions.filter((e) => e.status !== "resolved").length;

  const cargoKg = (shipment.packages ?? []).reduce(
    (sum, pkg) => sum + pkg.weightKg * (pkg.quantity || 1),
    0,
  );

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "documents", label: "Documents" },
    { key: "assignment", label: "Assignment" },
    { key: "payments", label: "Payments" },
    { key: "exceptions", label: "Exceptions", badge: openExceptions },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/dashboard/shipments">
          <ArrowLeft className="h-4 w-4" /> Shipments
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-dark">{shipment.reference}</h1>
            <ShipmentStatusBadge status={shipment.status} />
            {shipment.isCrossBorder && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                <Globe className="h-3 w-3" /> Cross-border
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-mute">{shipment.title}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-mute">Quote</p>
          <p className="font-semibold">
            {shipment.quoteAmount != null ? formatPrice(shipment.quoteAmount) : "-"}
          </p>
        </div>
      </div>

      {/* Parties & route */}
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-mute">
              <MapPin className="h-3.5 w-3.5" /> Route
            </p>
            <p className="mt-1.5 text-sm font-medium">{shipment.originAddress}</p>
            <p className="text-xs text-mute">→ {shipment.destinationAddress}</p>
            <p className="mt-1 text-xs text-mute">Cargo: {cargoKg.toLocaleString()} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-mute">
              <Building2 className="h-3.5 w-3.5" /> Parties
            </p>
            <p className="mt-1.5 text-sm">
              <span className="text-mute">Shipper:</span> {shipment.distributionOrg?.name}
            </p>
            <p className="text-sm">
              <span className="text-mute">Carrier:</span> {shipment.transportOrg?.name ?? "-"}
            </p>
            <p className="text-sm">
              <span className="text-mute">Agent:</span> {shipment.clearingAgentOrg?.name ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-mute">
              <Truck className="h-3.5 w-3.5" /> Execution
            </p>
            <p className="mt-1.5 text-sm">
              <span className="text-mute">Driver:</span>{" "}
              {shipment.assignedDriver
                ? `${shipment.assignedDriver.firstName} ${shipment.assignedDriver.lastName}`
                : "-"}
            </p>
            <p className="text-sm">
              <span className="text-mute">Vehicle:</span>{" "}
              {shipment.assignedVehicle
                ? `${shipment.assignedVehicle.plateNumber} (${shipment.assignedVehicle.model})`
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-mute">
              <UserIcon className="h-3.5 w-3.5" /> Recipient
            </p>
            <p className="mt-1.5 text-sm font-medium">{shipment.recipientName || "-"}</p>
            {shipment.recipientPhone && (
              <p className="flex items-center gap-1 text-xs text-mute">
                <Phone className="h-3 w-3" /> {shipment.recipientPhone}
              </p>
            )}
            {shipment.podCapturedAt && (
              <p className="mt-1 text-xs text-emerald-700">
                POD: {shipment.podRecipientName} · {formatDateTime(shipment.podCapturedAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <LifecycleActions data={data} onChanged={refresh} />

      {/* Tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {label}
            {badge ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "timeline" && <TimelinePanel shipment={shipment} access={access} onChanged={refresh} />}
        {tab === "documents" && (
          <DocumentsPanel shipment={shipment} documents={documents} access={access} onChanged={refresh} />
        )}
        {tab === "assignment" && (
          <AssignmentPanel shipment={shipment} access={access} onChanged={refresh} />
        )}
        {tab === "payments" && <PaymentsPanel shipment={shipment} access={access} />}
        {tab === "exceptions" && (
          <ExceptionsPanel shipment={shipment} exceptions={exceptions} access={access} onChanged={refresh} />
        )}
      </div>
    </div>
  );
}
