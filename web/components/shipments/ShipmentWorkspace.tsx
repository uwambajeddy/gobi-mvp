"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Globe,
  History,
  Mail,
  Map as MapIcon,
  Navigation,
  Package,
  Phone,
  Receipt,
  Route,
  Scale,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Meter, Skeleton } from "@/components/ui/feedback";
import { ShipmentMap } from "@/components/maps/ShipmentMap";
import { CountryTag, RouteDistance } from "@/components/maps/RouteFacts";
import { useMilestonePins, useShipmentGeo } from "@/hooks/useShipmentGeo";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { ErrorState } from "@/components/common/States";
import { LifecycleStepper } from "@/components/shipments/LifecycleStepper";
import { TimelinePanel } from "@/components/shipments/TimelinePanel";
import { DocumentsPanel } from "@/components/shipments/DocumentsPanel";
import { AssignmentPanel } from "@/components/shipments/AssignmentPanel";
import { PaymentsPanel } from "@/components/shipments/PaymentsPanel";
import { ExceptionsPanel } from "@/components/shipments/ExceptionsPanel";
import { handleApiError } from "@/lib/handleApiError";
import { ACTIVE_STATUSES, CANCELLABLE_STATUSES, cargoWeightKg, nextStepHint } from "@/lib/shipments";
import { cn, formatDate, formatDateTime, formatPrice, formatRelative, fullName } from "@/lib/utils";
import {
  Organization,
  Shipment,
  ShipmentAccess,
  ShipmentDocument,
  ShipmentEvent,
  ShipmentException,
} from "@/types";

type Tab = "timeline" | "documents" | "assignment" | "payments" | "exceptions";

interface WorkspaceData {
  shipment: Shipment;
  documents: ShipmentDocument[];
  exceptions: ShipmentException[];
  access: ShipmentAccess;
}

/* ------------------------------------------------------------------ */
/* Inline lifecycle forms                                               */
/* ------------------------------------------------------------------ */

/** Fields on the left, actions top-aligned with the inputs (below the labels). */
function InlineForm({
  children,
  actions,
  onCancel,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-inset border border-line/70 bg-surface-muted p-4 md:flex-row md:items-start">
      {children}
      <div className="flex gap-2 md:mt-[1.625rem]">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {actions}
      </div>
    </div>
  );
}

/** Assign a carrier / clearing agent from the organization directory. */
function AssignPartyForm({
  shipmentId,
  kind,
  onDone,
  onCancel,
}: {
  shipmentId: number;
  kind: "carrier" | "agent";
  onDone: () => void;
  onCancel: () => void;
}) {
  const axios = useAxiosAuth();
  const [orgId, setOrgId] = useState("");

  const companyType = kind === "carrier" ? "transport" : "clearing_agent";

  const { data: orgs, isLoading } = useQuery({
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
    <InlineForm
      onCancel={onCancel}
      actions={
        <Button disabled={!orgId} loading={assign.isPending} onClick={() => assign.mutate()}>
          Assign
        </Button>
      }
    >
      <Field label={kind === "carrier" ? "Transport company" : "Clearing agent"} className="md:min-w-72 md:flex-1">
        <Select value={orgId} onChange={(event) => setOrgId(event.target.value)} disabled={isLoading}>
          <option value="">{isLoading ? "Loading organizations..." : "Select organization..."}</option>
          {(orgs ?? []).map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      </Field>
    </InlineForm>
  );
}

/** Quote form for the carrier. */
function QuoteForm({
  shipmentId,
  onDone,
  onCancel,
}: {
  shipmentId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
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
    <InlineForm
      onCancel={onCancel}
      actions={
        <Button disabled={!amount} loading={quote.isPending} onClick={() => quote.mutate()}>
          Submit quote
        </Button>
      }
    >
      <Field label="Quote amount (RWF)" className="md:w-60">
        <Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
    </InlineForm>
  );
}

/** Proof-of-delivery capture. */
function PodForm({
  shipmentId,
  onDone,
  onCancel,
}: {
  shipmentId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
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
    <InlineForm
      onCancel={onCancel}
      actions={
        <Button disabled={recipient.trim().length < 2} loading={capture.isPending} onClick={() => capture.mutate()}>
          Capture POD
        </Button>
      }
    >
      <Field label="Received by" hint="At least 2 characters." className="md:w-56">
        <Input placeholder="Recipient name" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
      </Field>
      <Field label="Notes (condition, remarks)" optional className="md:flex-1">
        <Input
          placeholder="e.g. Received in full, no damages"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </InlineForm>
  );
}

/* ------------------------------------------------------------------ */
/* Lifecycle actions: status + role driven                              */
/* ------------------------------------------------------------------ */

/**
 * Points the user at the workspace tab where their next action lives.
 * Conditions mirror the ones each panel uses to show its controls.
 */
function tabHint(shipment: Shipment, access: ShipmentAccess): { text: string; tab: Tab; cta: string } | null {
  const party = access.isShipper || access.isCarrier || access.isAgent;
  if (access.isCarrierCoordinator && ["awaiting_documents", "documents_complete"].includes(shipment.status)) {
    return { text: "Dispatch a vehicle and driver from the Assignment tab.", tab: "assignment", cta: "Open assignment" };
  }
  if (party && shipment.status === "awaiting_documents") {
    return { text: "Upload the outstanding documents in the Documents tab.", tab: "documents", cta: "Open documents" };
  }
  if (
    (party || access.isAssignedDriver) &&
    ["execution_assigned", "in_transit", "arrived"].includes(shipment.status)
  ) {
    return { text: "Record pickup, corridor milestones and arrival on the Timeline tab.", tab: "timeline", cta: "Record milestone" };
  }
  return null;
}

function LifecycleActions({
  data,
  onChanged,
  onOpenTab,
}: {
  data: WorkspaceData;
  onChanged: () => void;
  onOpenTab: (tab: Tab) => void;
}) {
  const axios = useAxiosAuth();
  const { shipment, access } = data;
  const hint = tabHint(shipment, access);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

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
      setConfirmCancel(false);
      onChanged();
    },
    onError: handleApiError,
  });

  const actions: {
    key: string;
    label: string;
    variant?: "default" | "outline" | "destructive-outline";
    run?: () => void;
  }[] = [];

  if (access.isShipper && shipment.status === "draft") {
    actions.push({ key: "submit", label: "Submit shipment", run: () => simpleAction.mutate("submit") });
  }
  if (access.isShipperCoordinator && shipment.status === "submitted" && !shipment.transportOrgId) {
    actions.push({ key: "assign-carrier", label: "Assign carrier", variant: "default" });
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
    actions.push({
      key: "quote",
      label: shipment.quoteAmount ? "Update quote" : "Submit quote",
      variant: shipment.quoteAmount ? "outline" : "default",
    });
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
    actions.push({ key: "pod", label: "Capture POD", variant: "default" });
  }
  if (access.isShipperCoordinator && shipment.status === "delivered") {
    actions.push({
      key: "complete",
      label: "Confirm receipt & complete",
      run: () => simpleAction.mutate("complete"),
    });
  }
  if (access.isShipperCoordinator && CANCELLABLE_STATUSES.includes(shipment.status)) {
    actions.push({
      key: "cancel",
      label: "Cancel shipment",
      variant: "destructive-outline",
      run: () => setConfirmCancel(true),
    });
  }

  const closeForm = () => setOpenForm(null);
  const formDone = () => {
    setOpenForm(null);
    onChanged();
  };

  return (
    <Card className="mt-5">
      <CardContent className="pt-5 sm:pt-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary-50 text-primary-600">
              <ClipboardCheck className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-overline text-ink-muted">Next step</p>
              <p className="text-label font-semibold text-ink">{nextStepHint(shipment)}</p>
              {hint ? (
                <p className="text-caption text-ink-muted">{hint.text}</p>
              ) : (
                actions.length === 0 &&
                !["completed", "cancelled"].includes(shipment.status) && (
                  <p className="text-caption text-ink-muted">No action is available to you at this stage.</p>
                )
              )}
            </div>
          </div>
          {(actions.length > 0 || hint) && (
            <div className="flex flex-wrap gap-2">
              {hint && (
                <Button variant={actions.some((a) => (a.variant ?? "default") === "default") ? "outline" : "default"} onClick={() => onOpenTab(hint.tab)}>
                  {hint.cta}
                </Button>
              )}
              {actions.map(({ key, label, variant, run }) => (
                <Button
                  key={key}
                  variant={variant ?? (run ? "default" : "outline")}
                  aria-expanded={run ? undefined : openForm === key}
                  disabled={simpleAction.isPending}
                  loading={simpleAction.isPending && simpleAction.variables === key}
                  onClick={() => (run ? run() : setOpenForm(openForm === key ? null : key))}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {openForm === "assign-carrier" && (
          <AssignPartyForm shipmentId={shipment.id} kind="carrier" onDone={formDone} onCancel={closeForm} />
        )}
        {openForm === "assign-agent" && (
          <AssignPartyForm shipmentId={shipment.id} kind="agent" onDone={formDone} onCancel={closeForm} />
        )}
        {openForm === "quote" && <QuoteForm shipmentId={shipment.id} onDone={formDone} onCancel={closeForm} />}
        {openForm === "pod" && <PodForm shipmentId={shipment.id} onDone={formDone} onCancel={closeForm} />}
      </CardContent>

      <ConfirmDialog
        open={confirmCancel}
        tone="danger"
        title="Cancel this shipment?"
        description={
          <>
            <span className="font-mono">{shipment.reference}</span> will move to Cancelled. This cannot be
            undone.
          </>
        }
        confirmLabel="Cancel shipment"
        loading={simpleAction.isPending && simpleAction.variables === "cancel"}
        onConfirm={() => simpleAction.mutate("cancel")}
        onCancel={() => setConfirmCancel(false)}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Side panels                                                          */
/* ------------------------------------------------------------------ */

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Package;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-sunken text-ink-secondary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-overline text-ink-muted">{label}</p>
        <div className="text-label text-ink">{children}</div>
      </div>
    </div>
  );
}

const NotSet = ({ children = "Not assigned" }: { children?: string }) => (
  <span className="font-normal text-ink-subtle">{children}</span>
);

function OrgLine({ org }: { org?: Organization | null }) {
  if (!org) return <NotSet />;
  return (
    <>
      <span className="block truncate font-semibold">{org.name}</span>
      {(org.contactEmail || org.contactPhone) && (
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-caption font-normal text-ink-muted">
          {org.contactEmail && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" aria-hidden /> {org.contactEmail}
            </span>
          )}
          {org.contactPhone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" aria-hidden /> {org.contactPhone}
            </span>
          )}
        </span>
      )}
    </>
  );
}

function SidePanels({ shipment }: { shipment: Shipment }) {
  const packages = shipment.packages ?? [];
  const cargoKg = cargoWeightKg(shipment);
  const capacityKg = shipment.assignedVehicle?.capacityKg ?? 0;
  const loadPct = capacityKg ? Math.round((cargoKg / capacityKg) * 100) : 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <Users className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Parties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow icon={Building2} label="Shipper">
            <OrgLine org={shipment.distributionOrg} />
          </InfoRow>
          <InfoRow icon={Truck} label="Carrier">
            <OrgLine org={shipment.transportOrg} />
          </InfoRow>
          <InfoRow icon={Globe} label="Clearing agent">
            <OrgLine org={shipment.clearingAgentOrg} />
          </InfoRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <Truck className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Execution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow icon={UserRound} label="Driver">
            {shipment.assignedDriver ? (
              <>
                <span className="block font-semibold">{fullName(shipment.assignedDriver)}</span>
                {shipment.assignedDriver.phoneNumber && (
                  <span className="text-caption font-normal text-ink-muted">{shipment.assignedDriver.phoneNumber}</span>
                )}
              </>
            ) : (
              <NotSet />
            )}
          </InfoRow>
          <InfoRow icon={Truck} label="Vehicle">
            {shipment.assignedVehicle ? (
              <>
                <span className="block font-semibold">{shipment.assignedVehicle.plateNumber}</span>
                <span className="text-caption font-normal text-ink-muted">
                  {shipment.assignedVehicle.model}
                  {shipment.assignedVehicle.capacityKg
                    ? ` · ${shipment.assignedVehicle.capacityKg.toLocaleString()} kg capacity`
                    : ""}
                </span>
              </>
            ) : (
              <NotSet />
            )}
          </InfoRow>
          {capacityKg ? (
            <div className="tile rounded-inset p-3">
              <div className="flex items-baseline justify-between gap-2 text-caption">
                <span className="font-medium text-ink-secondary">Vehicle load</span>
                <span className="tabular-nums text-ink">
                  <span className="font-semibold">{loadPct}%</span>{" "}
                  <span className="text-ink-muted">
                    · {cargoKg.toLocaleString()} / {capacityKg.toLocaleString()} kg
                  </span>
                </span>
              </div>
              <Meter
                className="mt-2"
                value={cargoKg}
                max={capacityKg}
                tone={loadPct > 100 ? "danger" : loadPct > 85 ? "warning" : "brand"}
                label="Vehicle load"
              />
              {loadPct > 100 && (
                <p className="mt-1.5 text-caption font-medium text-danger-fg">Cargo exceeds this vehicle&apos;s capacity.</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <Boxes className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Cargo
          </CardTitle>
          <Badge variant="secondary">{cargoKg.toLocaleString()} kg</Badge>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-body text-ink-muted">No packages recorded.</p>
          ) : (
            <ul className="divide-y divide-line/60 rounded-inset border border-line/70">
              {packages.map((pkg, index) => (
                <li key={pkg.id ?? index} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-label text-ink">{pkg.description}</span>
                    <span className="text-caption text-ink-muted">
                      {pkg.quantity} × {pkg.weightKg.toLocaleString()} kg
                    </span>
                  </span>
                  <span className="shrink-0 text-label tabular-nums text-ink-secondary">
                    {(pkg.weightKg * (pkg.quantity || 1)).toLocaleString()} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            <UserRound className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Recipient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-label font-semibold text-ink">{shipment.recipientName || <NotSet>Not provided</NotSet>}</p>
            {shipment.recipientPhone && (
              <p className="mt-0.5 flex items-center gap-1 text-caption text-ink-muted">
                <Phone className="h-3 w-3" aria-hidden /> {shipment.recipientPhone}
              </p>
            )}
          </div>
          {shipment.podCapturedAt ? (
            <div className="rounded-inset border border-success-line/70 bg-success-soft p-3.5">
              <p className="text-overline text-success-fg">Proof of delivery</p>
              <p className="mt-1 text-label font-semibold text-ink">Received by {shipment.podRecipientName}</p>
              <p className="text-caption text-ink-secondary">{formatDateTime(shipment.podCapturedAt)}</p>
              {shipment.podNotes && <p className="mt-1.5 text-caption text-ink-secondary">{shipment.podNotes}</p>}
            </div>
          ) : (
            <p className="text-caption text-ink-muted">Proof of delivery has not been captured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Route + map                                                          */
/* ------------------------------------------------------------------ */

/** Origin → destination with the country Google placed each in. */
function RouteEndpoints({ shipment }: { shipment: Shipment }) {
  const geo = useShipmentGeo(shipment);
  const stops = [
    { label: "Origin", address: shipment.originAddress, place: geo.origin, dot: "border-2 border-success bg-surface" },
    { label: "Destination", address: shipment.destinationAddress, place: geo.destination, dot: "bg-primary-500" },
  ];
  return (
    <div className="mt-5 tile rounded-inset p-4">
      <ol className="relative space-y-3">
        <span aria-hidden className="absolute left-[5px] top-3 h-[calc(100%-1.75rem)] w-0.5 border-l-2 border-dashed border-line-strong" />
        {stops.map(({ label, address, place, dot }) => (
          <li key={label} className="relative flex gap-3">
            <span aria-hidden className={cn("relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full", dot)} />
            <div className="min-w-0">
              <p className="text-overline text-ink-muted">{label}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-label font-semibold text-ink">
                {address}
                <CountryTag code={place?.countryCode} name={place?.countryName} />
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 border-t border-line/60 pt-3 text-caption text-ink-secondary">
        <Route className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
        <RouteDistance geo={geo} />
      </p>
    </div>
  );
}

/** Planned route plus every place reported on the timeline. */
function HeaderRouteMap({ shipment }: { shipment: Shipment }) {
  const axios = useAxiosAuth();
  const geo = useShipmentGeo(shipment);
  // Same key as the Timeline tab, so recording a milestone refreshes the pins.
  const { data: events } = useQuery({
    queryKey: ["shipment-events", String(shipment.id)],
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/events`)).data.data.events as ShipmentEvent[],
  });
  const milestones = useMilestonePins(events, {
    origin: geo.origin,
    destination: geo.destination,
    settled: !geo.isLocating,
  });
  const latest = milestones.latest;
  const latestEvent = latest?.events[latest.events.length - 1];

  return (
    <div className="flex h-full flex-col gap-2.5">
      <ShipmentMap
        label={`Route map for ${shipment.reference}`}
        geo={geo}
        pins={milestones.pins}
        pinsUnresolved={milestones.unresolved}
        className="h-64 rounded-inset border border-line/70 xl:h-auto xl:min-h-[18rem] xl:flex-1"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-caption">
        <p className="flex min-w-0 items-center gap-1.5 text-ink-secondary">
          <Navigation className="h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden />
          {latest && latestEvent ? (
            <span className="truncate">
              <span className="font-semibold text-ink">Last reported:</span> {latest.locationName} ·{" "}
              {formatRelative(latestEvent.occurredAt)}
            </span>
          ) : (
            <span className="text-ink-muted">No location reported yet</span>
          )}
        </p>
        {ACTIVE_STATUSES.includes(shipment.status) && (
          <Link
            href={`/dashboard?shipment=${shipment.id}#ongoing-shipments`}
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded font-medium text-primary-600 hover:underline"
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden /> View on overview map
          </Link>
        )}
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading shipment" className="space-y-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-60 rounded-card" />
      <Skeleton className="h-20 rounded-card" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    </div>
  );
}

export default function ShipmentWorkspace({ id }: { id: string }) {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("timeline");
  const [focusTab, setFocusTab] = useState<Tab | null>(null);

  // After a "next step" shortcut switches tabs, bring the panel into view and
  // move focus to its tab so keyboard users continue from there.
  useEffect(() => {
    if (!focusTab) return;
    const timer = window.setTimeout(() => {
      const tabEl = document.getElementById(`shipment-tab-${focusTab}`);
      tabEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      tabEl?.focus({ preventScroll: true });
      setFocusTab(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusTab]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["shipment", id],
    queryFn: async () => (await axios.get(`/api/v1/shipments/${id}`)).data.data as WorkspaceData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["shipment", id] });
    queryClient.invalidateQueries({ queryKey: ["shipment-events", id] });
    queryClient.invalidateQueries({ queryKey: ["shipments"] });
  };

  if (isLoading) return <WorkspaceSkeleton />;

  if (!data) {
    return (
      <Card className="mx-auto mt-6 max-w-xl">
        <ErrorState
          title="Shipment not found or you are not a party to it"
          error={error}
          onRetry={() => refetch()}
        />
        <div className="-mt-6 flex justify-center pb-8">
          <Button variant="link" asChild>
            <Link href="/dashboard/shipments">Back to shipments</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const { shipment, documents, exceptions, access } = data;
  const openExceptions = exceptions.filter((e) => e.status !== "resolved").length;
  const cargoKg = cargoWeightKg(shipment);
  const mandatory = documents.filter((doc) => doc.mandatory);
  const satisfied = mandatory.filter((doc) => ["uploaded", "verified"].includes(doc.status));
  // Quotes and payments are not shared with drivers; the API leaves them out.
  const canSeeMoney = Boolean(access.can?.viewFinancials);

  const meta: { icon: typeof Package; label: string; value: React.ReactNode; hint?: string }[] = [
    ...(canSeeMoney
      ? [
          {
            icon: CircleDollarSign,
            label: "Quote",
            value: shipment.quoteAmount != null ? formatPrice(shipment.quoteAmount) : "No quote yet",
            hint: shipment.quoteApprovedAt
              ? `Approved ${formatDate(shipment.quoteApprovedAt)}`
              : shipment.quoteAmount != null
                ? "Awaiting shipper approval"
                : shipment.transportOrg
                  ? `Requested from ${shipment.transportOrg.name}`
                  : "Assign a carrier to request one",
          },
        ]
      : []),
    {
      icon: Scale,
      label: "Cargo weight",
      value: `${cargoKg.toLocaleString()} kg`,
      hint: `${shipment.packages?.length ?? 0} package line${shipment.packages?.length === 1 ? "" : "s"}`,
    },
    {
      icon: FileText,
      label: "Documents",
      value: mandatory.length ? `${satisfied.length} of ${mandatory.length} mandatory` : "Not started",
      hint: mandatory.length ? (satisfied.length === mandatory.length ? "Gate passed" : "Gate not satisfied") : "Opens after quote approval",
    },
    {
      icon: History,
      label: "Last updated",
      value: <span title={formatDateTime(shipment.updatedAt)}>{formatRelative(shipment.updatedAt)}</span>,
      hint: `Created ${formatDate(shipment.createdAt)}`,
    },
  ];

  return (
    <div>
      <Link
        href="/dashboard/shipments"
        className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded-md text-label text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Shipments
      </Link>

      {/* Summary header */}
      <Card className="overflow-hidden">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <div className="p-5 sm:p-6">
          <div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-caption font-medium text-ink-secondary">
                  {shipment.reference}
                </span>
                <ShipmentStatusBadge status={shipment.status} />
                {shipment.isCrossBorder && (
                  <Badge variant="info">
                    <Globe className="h-3 w-3" aria-hidden /> Cross-border
                  </Badge>
                )}
                {openExceptions > 0 && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> {openExceptions} open exception
                    {openExceptions === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              <h1 className="font-display mt-2.5 text-title font-bold text-ink">{shipment.title}</h1>
              {shipment.createdBy && (
                <p className="mt-1 text-caption text-ink-muted">Created by {fullName(shipment.createdBy)}</p>
              )}
            </div>
          </div>

          {/* Route */}
          <RouteEndpoints shipment={shipment} />

          {/* Key facts */}
          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            {meta.map(({ icon: Icon, label, value, hint }) => (
              <div key={label} className="tile min-w-0 rounded-inset px-3.5 py-3">
                <dt className="flex items-center gap-1.5 text-caption text-ink-muted">
                  <Icon className="h-3.5 w-3.5 text-primary-500" aria-hidden /> {label}
                </dt>
                <dd className="font-display mt-1 truncate text-[0.9375rem] font-bold tabular-nums leading-5 text-ink">
                  {value}
                </dd>
                {hint && <dd className="truncate text-caption text-ink-muted">{hint}</dd>}
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-line/70 bg-surface-muted/60 p-3 xl:border-l xl:border-t-0">
          <HeaderRouteMap shipment={shipment} />
        </div>
        </div>

        <div className="border-t border-line/70 bg-surface-muted/70 px-5 py-5 sm:px-6">
          <LifecycleStepper status={shipment.status} />
        </div>
      </Card>

      <LifecycleActions
        data={data}
        onChanged={refresh}
        onOpenTab={(next) => {
          setTab(next);
          setFocusTab(next);
        }}
      />

      {/* Workspace */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Tabs
            idBase="shipment"
            label="Shipment workspace"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "timeline", label: "Timeline", icon: History },
              { value: "documents", label: "Documents", icon: FileText, count: documents.length },
              { value: "assignment", label: "Assignment", icon: Truck },
              ...(access.can?.listPayments
                ? [{ value: "payments" as const, label: "Payments", icon: Receipt }]
                : []),
              {
                value: "exceptions",
                label: "Exceptions",
                icon: AlertTriangle,
                count: openExceptions,
                countTone: "danger",
              },
            ]}
          />
          <TabPanel idBase="shipment" value={tab} className="mt-4">
            {tab === "timeline" && <TimelinePanel shipment={shipment} access={access} onChanged={refresh} />}
            {tab === "documents" && (
              <DocumentsPanel shipment={shipment} documents={documents} access={access} onChanged={refresh} />
            )}
            {tab === "assignment" && <AssignmentPanel shipment={shipment} access={access} onChanged={refresh} />}
            {tab === "payments" && access.can?.listPayments && <PaymentsPanel shipment={shipment} access={access} />}
            {tab === "exceptions" && (
              <ExceptionsPanel shipment={shipment} exceptions={exceptions} access={access} onChanged={refresh} />
            )}
          </TabPanel>
        </div>

        <aside className={cn("min-w-0")} aria-label="Shipment details">
          <SidePanels shipment={shipment} />
        </aside>
      </div>
    </div>
  );
}
