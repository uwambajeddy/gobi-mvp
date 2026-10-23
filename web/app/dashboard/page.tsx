"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  ClipboardList,
  FileWarning,
  Globe,
  Inbox,
  Package,
  PackageCheck,
  Route,
  Truck,
  UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { BarList } from "@/components/common/BarList";
import { OngoingShipmentsMap } from "@/components/maps/OngoingShipmentsMap";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { COMPANY_TYPE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/labels";
import {
  ACTIVE_STATUSES,
  ATTENTION_STATUSES,
  FILTER_STATUSES,
  countByStatus,
  nextStepHint,
} from "@/lib/shipments";
import { cn, formatRelative } from "@/lib/utils";
import { CompanyType, Shipment, ShipmentStatus } from "@/types";

const COMPANY_OPTIONS: { value: CompanyType; description: string; icon: typeof Package }[] = [
  {
    value: "distribution",
    description: "Create shipments, award carriers and confirm delivery.",
    icon: Package,
  },
  {
    value: "transport",
    description: "Quote, assign vehicles and drivers, and execute shipments.",
    icon: Truck,
  },
  {
    value: "clearing_agent",
    description: "Handle customs documents and border milestones.",
    icon: Globe,
  },
];

/** Onboarding for users without an organization: create one inline. */
function CreateOrgCard() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType>("distribution");

  const createOrg = useMutation({
    mutationFn: async () => axios.post("/api/v1/organizations", { name, companyType }),
    onSuccess: () => {
      toast.success("Organization created. You are the owner.");
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
    },
    onError: handleApiError,
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              <Building2 className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Set up your
              organization
            </CardTitle>
            <CardDescription>
              You become its owner and can add colleagues once it exists.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              createOrg.mutate();
            }}
          >
            <Field label="Organization name" hint="At least 2 characters." required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Kigali Distribution Ltd"
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-label text-ink-secondary">Company type</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {COMPANY_OPTIONS.map(({ value, description, icon: Icon }) => {
                  const selected = companyType === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "relative flex cursor-pointer flex-col gap-2 rounded-inset border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500",
                        selected
                          ? "border-primary-300 bg-primary-50/60"
                          : "border-line hover:border-line-strong hover:bg-surface-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name="companyType"
                        value={value}
                        checked={selected}
                        onChange={() => setCompanyType(value)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-[0.625rem]",
                          selected ? "bg-primary-500 text-white" : "bg-surface-sunken text-ink-secondary",
                        )}
                      >
                        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                      </span>
                      <span className="text-label font-semibold text-ink">{COMPANY_TYPE_LABELS[value]}</span>
                      <span className="text-caption text-ink-muted">{description}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={name.trim().length < 2}
              loading={createOrg.isPending}
            >
              {createOrg.isPending ? "Creating..." : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-surface-muted/60">
        <CardHeader>
          <div>
            <CardTitle>
              <UserPlus className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Joining an
              existing company?
            </CardTitle>
            <CardDescription>
              Ask an owner or coordinator of that organization to add you on their Organization page
              using the email you registered with. It will appear here as soon as they do.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              "Share your registered email with the organization owner.",
              "They add you with a role: coordinator, member or driver.",
              "Reload Gobi: your workspace and navigation switch on.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3 text-body text-ink-secondary">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-caption font-semibold text-ink shadow-card">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ShipmentRow({ shipment, hint }: { shipment: Shipment; hint?: boolean }) {
  return (
    <li>
      <Link
        href={`/dashboard/shipments/${shipment.id}`}
        className="focus-ring group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted sm:px-6"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-sunken text-ink-secondary">
          <Package className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-caption text-ink-muted">{shipment.reference}</span>
            {shipment.isCrossBorder && (
              <Globe className="h-3.5 w-3.5 text-info-fg" aria-label="Cross-border" />
            )}
          </span>
          <span className="block truncate text-label font-semibold text-ink">{shipment.title}</span>
          <span className="block truncate text-caption text-ink-muted">
            {hint ? nextStepHint(shipment) : `${shipment.originAddress} → ${shipment.destinationAddress}`}
          </span>
        </span>
        <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <ShipmentStatusBadge status={shipment.status} />
          <span className="text-caption text-ink-muted">{formatRelative(shipment.updatedAt)}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

function OrgHome() {
  const axios = useAxiosAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeMembership } = useActiveOrg();

  const {
    data: shipments,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => (await axios.get("/api/v1/shipments")).data.data.shipments as Shipment[],
  });

  const isShipper = activeMembership?.organization?.companyType === "distribution";

  const list = shipments ?? [];
  const counts = countByStatus(list);
  const active = list.filter((s) => ACTIVE_STATUSES.includes(s.status));
  const needsAttention = list.filter((s) => ATTENTION_STATUSES.includes(s.status));

  const stageItems = (
    [...FILTER_STATUSES, "quote_approved"] as ShipmentStatus[]
  )
    .filter((status) => (counts[status] ?? 0) > 0)
    .map((status) => ({
      key: status,
      label: SHIPMENT_STATUS_LABELS[status],
      value: counts[status] ?? 0,
      href: status === "quote_approved" ? undefined : `/dashboard/shipments?status=${status}`,
    }));

  const kpis: {
    status: ShipmentStatus;
    label: string;
    detail: string;
    icon: typeof Package;
    tone: "warning" | "brand" | "info" | "success";
  }[] = [
    { status: "awaiting_documents", label: "Awaiting documents", detail: "Mandatory documents outstanding", icon: FileWarning, tone: "warning" },
    { status: "execution_assigned", label: "Ready to move", detail: "Vehicle and driver assigned", icon: Truck, tone: "brand" },
    { status: "in_transit", label: "In transit", detail: "On the road now", icon: Route, tone: "info" },
    { status: "delivered", label: "Awaiting confirmation", detail: "Delivered, not yet closed", icon: PackageCheck, tone: "success" },
  ];

  // The map selection lives in the URL so a shipment can link straight to it.
  const selectedId = Number(searchParams?.get("shipment")) || undefined;
  const selectShipment = (id: number) => router.replace(`/dashboard?shipment=${id}`, { scroll: false });

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load your shipments" />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(({ status, label, detail, icon, tone }) => (
          <StatCard
            key={status}
            compact
            href={`/dashboard/shipments?status=${status}`}
            label={label}
            value={counts[status] ?? 0}
            detail={detail}
            icon={icon}
            tone={tone}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Map */}
      <OngoingShipmentsMap
        shipments={list}
        isLoading={isLoading}
        selectedId={selectedId}
        onSelect={selectShipment}
        canCreate={isShipper}
      />

      <div className="grid items-start gap-5 xl:grid-cols-3">
        {/* Attention queue */}
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader className="items-center">
            <div>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>
                {isLoading
                  ? "Checking shipments..."
                  : `${needsAttention.length} of ${active.length} in-progress shipments are waiting on someone.`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/shipments">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          {isLoading ? (
            <ListSkeleton rows={3} className="border-t border-line/60" />
          ) : needsAttention.length === 0 ? (
            <EmptyState
              compact
              icon={Inbox}
              title="Nothing waiting on you"
              description={`${active.length} shipment(s) progressing normally.`}
              className="border-t border-line/60"
            />
          ) : (
            <ul className="divide-y divide-line/60 border-t border-line/60">
              {needsAttention.slice(0, 6).map((shipment) => (
                <ShipmentRow key={shipment.id} shipment={shipment} hint />
              ))}
            </ul>
          )}
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Shipments by status</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${list.length} shipment${list.length === 1 ? "" : "s"} you take part in`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-3.5">
            {isLoading ? (
              <ListSkeleton rows={4} />
            ) : stageItems.length === 0 ? (
              <EmptyState compact icon={Package} title="No shipments yet" />
            ) : (
              <>
                <BarList items={stageItems} total={list.length} />
                <p className="mt-3 px-2.5 text-caption text-ink-muted">Statuses with no shipments are hidden.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { memberships, activeMembership, isLoading } = useActiveOrg();

  const userType = session?.user?.type;

  useEffect(() => {
    if (userType === "admin") router.replace("/dashboard/admin");
  }, [userType, router]);

  if (status === "loading" || userType === "admin" || isLoading) {
    return <PageSkeleton />;
  }

  const org = activeMembership?.organization;

  return (
    <>
      <PageHeader
        eyebrow={org ? `${org.name} · ${COMPANY_TYPE_LABELS[org.companyType] ?? org.companyType}` : "Welcome to Gobi"}
        title={`${greeting()}, ${session?.user?.firstName ?? ""}`}
        description={
          activeMembership
            ? "Here is where your shipments stand right now."
            : "Let's get your workspace set up."
        }
        actions={
          activeMembership && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/shipments">
                <ClipboardList /> {activeMembership.role === "driver" ? "My assignments" : "Shipments"}
              </Link>
            </Button>
          )
        }
      />
      {memberships.length === 0 ? (
        <CreateOrgCard />
      ) : (
        <Suspense fallback={<PageSkeleton />}>
          <OrgHome />
        </Suspense>
      )}
    </>
  );
}
