"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Globe, Map as MapIcon, MapPin, Navigation, PackagePlus, Route, Truck } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { type ShipmentGeo, useMilestonePins, useShipmentGeo } from "@/hooks/useShipmentGeo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPills } from "@/components/ui/filter-pills";
import { Meter, Skeleton } from "@/components/ui/feedback";
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/States";
import { LifecycleStepper } from "@/components/shipments/LifecycleStepper";
import { ShipmentMap } from "@/components/maps/ShipmentMap";
import { CountryTag, RouteDistance } from "@/components/maps/RouteFacts";
import { ACTIVE_STATUSES, cargoWeightKg } from "@/lib/shipments";
import { cn, formatPrice, formatRelative, fullName } from "@/lib/utils";
import { Shipment, ShipmentEvent, ShipmentStatus } from "@/types";

type Filter = "all" | "moving" | "preparing" | "delivered";

const GROUPS: Record<Exclude<Filter, "all">, ShipmentStatus[]> = {
  moving: ["execution_assigned", "in_transit", "arrived"],
  preparing: ["submitted", "quote_approved", "awaiting_documents", "documents_complete"],
  delivered: ["delivered"],
};

const useIsWide = () => {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
};

/* ------------------------------------------------------------------ */
/* List card                                                            */
/* ------------------------------------------------------------------ */

function ShipmentListCard({
  shipment,
  selected,
  onSelect,
}: {
  shipment: Shipment;
  selected: boolean;
  onSelect: () => void;
}) {
  const geo = useShipmentGeo(shipment);

  return (
    <li className="relative w-[17rem] shrink-0 snap-start lg:w-auto">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "focus-ring w-full rounded-inset border bg-surface p-3.5 text-left transition-[border-color,box-shadow,background-color] duration-150",
          selected
            ? "border-dashed border-primary-400 bg-primary-50/50 shadow-raised"
            : "border-line/70 shadow-card hover:border-line-strong hover:shadow-raised",
        )}
      >
        <div className="flex items-start gap-3 pr-6">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem]",
              selected ? "bg-primary-500 text-white shadow-brand" : "bg-surface-sunken text-ink-secondary",
            )}
          >
            <Truck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-label font-semibold text-ink">{shipment.reference}</p>
            <p className="truncate text-caption text-ink-secondary">{shipment.title}</p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ShipmentStatusBadge status={shipment.status} />
          {shipment.isCrossBorder && (
            <Badge variant="info">
              <Globe className="h-3 w-3" aria-hidden /> Cross-border
            </Badge>
          )}
        </div>

        <div className="mt-2.5 flex min-w-0 items-center gap-1.5 text-caption text-ink">
          <CountryTag code={geo.origin?.countryCode} name={geo.origin?.countryName} />
          <span className="min-w-0 truncate">{shipment.originAddress}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-ink-subtle" aria-label="to" />
          <CountryTag code={geo.destination?.countryCode} name={geo.destination?.countryName} />
          <span className="min-w-0 truncate">{shipment.destinationAddress}</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-caption text-ink-muted">
          <Route className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <RouteDistance geo={geo} withDuration={false} />
        </p>
      </button>
      <Link
        href={`/dashboard/shipments/${shipment.id}`}
        aria-label={`Open ${shipment.reference}`}
        title="Open shipment"
        className="focus-ring absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Floating details card                                                */
/* ------------------------------------------------------------------ */

function DetailsCard({
  shipment,
  geo,
  latest,
  className,
}: {
  shipment: Shipment;
  geo: ShipmentGeo;
  latest?: { locationName: string; label: string; at: string };
  className?: string;
}) {
  const cargoKg = cargoWeightKg(shipment);
  const capacity = shipment.assignedVehicle?.capacityKg ?? null;
  const loadPct = capacity ? Math.round((cargoKg / capacity) * 100) : null;

  return (
    // Denser glass than the default: it floats over map imagery, not the canvas.
    <Card className={cn("bg-white/80 p-4 shadow-overlay", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-heading text-ink">
            <span className="font-mono">{shipment.reference}</span>
          </p>
          <ShipmentStatusBadge status={shipment.status} />
        </div>
        <Button variant="link" size="sm" asChild>
          <Link href={`/dashboard/shipments/${shipment.id}`}>
            View details <ArrowRight />
          </Link>
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line/70 pb-3.5 xl:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-overline text-ink-muted">Carrier</dt>
          <dd className="truncate text-label font-semibold text-ink">
            {shipment.transportOrg?.name ?? <span className="font-normal text-ink-subtle">Not assigned</span>}
          </dd>
          <dd className="truncate text-caption text-ink-muted">
            {shipment.assignedDriver ? `Driver: ${fullName(shipment.assignedDriver)}` : "No driver yet"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-overline text-ink-muted">Vehicle</dt>
          <dd className="truncate text-label font-semibold text-ink">
            {shipment.assignedVehicle?.plateNumber ?? <span className="font-normal text-ink-subtle">Not assigned</span>}
          </dd>
          {shipment.assignedVehicle && <dd className="truncate text-caption text-ink-muted">{shipment.assignedVehicle.model}</dd>}
        </div>
        <div className="min-w-0">
          <dt className="text-overline text-ink-muted">Cargo</dt>
          <dd className="text-label font-semibold tabular-nums text-ink">
            {cargoKg.toLocaleString()} kg
            {loadPct != null && <span className="ml-1 font-normal text-ink-muted">({loadPct}% load)</span>}
          </dd>
          {loadPct != null && (
            <Meter
              className="mt-1.5 h-1.5"
              value={cargoKg}
              max={capacity!}
              tone={loadPct > 100 ? "danger" : loadPct > 85 ? "warning" : "brand"}
              label="Vehicle load"
            />
          )}
        </div>
        {/* The API leaves the quote out (undefined, not null) for callers who may not see it. */}
        {shipment.quoteAmount !== undefined && (
          <div className="min-w-0">
            <dt className="text-overline text-ink-muted">Quote</dt>
            <dd className="text-label font-semibold tabular-nums text-ink">
              {shipment.quoteAmount != null ? formatPrice(shipment.quoteAmount) : <span className="font-normal text-ink-subtle">None yet</span>}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-col gap-1.5 text-caption text-ink-secondary 2xl:flex-row 2xl:items-start 2xl:justify-between 2xl:gap-4">
        <p className="flex min-w-0 items-start gap-1.5">
          <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden />
          {latest ? (
            <span>
              <span className="font-semibold text-ink">Last reported:</span> {latest.locationName} · {latest.label} ·{" "}
              {formatRelative(latest.at)}
            </span>
          ) : (
            <span>No location has been reported on the timeline yet.</span>
          )}
        </p>
        <p className="flex shrink-0 items-start gap-1.5">
          <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
          <RouteDistance geo={geo} />
        </p>
      </div>

      <div className="mt-3">
        <LifecycleStepper status={shipment.status} size="sm" />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                              */
/* ------------------------------------------------------------------ */

/**
 * Overview map: ongoing shipments on the left, the selected one's planned
 * route and reported milestones on the map, details floating over it.
 */
export function OngoingShipmentsMap({
  shipments,
  isLoading,
  selectedId,
  onSelect,
  canCreate,
}: {
  shipments: Shipment[];
  isLoading: boolean;
  selectedId?: number;
  onSelect: (id: number) => void;
  canCreate?: boolean;
}) {
  const axios = useAxiosAuth();
  const isWide = useIsWide();
  const [filter, setFilter] = useState<Filter>("all");

  const ongoing = useMemo(() => shipments.filter((s) => ACTIVE_STATUSES.includes(s.status)), [shipments]);
  const visible = filter === "all" ? ongoing : ongoing.filter((s) => GROUPS[filter].includes(s.status));
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0] ?? null;

  const { data: events } = useQuery({
    queryKey: ["shipment-events", String(selected?.id)],
    enabled: Boolean(selected),
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${selected!.id}/events`)).data.data.events as ShipmentEvent[],
  });

  const geo = useShipmentGeo(selected);
  const milestones = useMilestonePins(selected ? events : [], {
    origin: geo.origin,
    destination: geo.destination,
    settled: !geo.isLocating,
  });
  const latestEvent = milestones.latest?.events[milestones.latest.events.length - 1];

  const count = (key: Exclude<Filter, "all">) => ongoing.filter((s) => GROUPS[key].includes(s.status)).length;

  return (
    <Card id="ongoing-shipments" className="overflow-hidden">
      <CardHeader className="items-center">
        <div>
          <CardTitle>
            <MapIcon className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Ongoing shipments
          </CardTitle>
          <CardDescription>
            Planned routes and the places reported on each timeline. Not live GPS.
          </CardDescription>
        </div>
        {!isLoading && ongoing.length > 0 && (
          <FilterPills
            label="Filter ongoing shipments"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: ongoing.length },
              { value: "moving", label: "On the road", count: count("moving") },
              { value: "preparing", label: "Preparing", count: count("preparing") },
              { value: "delivered", label: "Delivered", count: count("delivered") },
            ]}
          />
        )}
      </CardHeader>

      {isLoading ? (
        <div className="grid gap-3 border-t border-line/60 p-3 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-inset" />
            ))}
          </div>
          <Skeleton className="h-[26rem] rounded-inset lg:h-[34rem]" />
        </div>
      ) : ongoing.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No shipments on the move"
          description="Shipments appear on the map from submission until they are completed."
          action={
            canCreate && (
              <Button asChild size="sm">
                <Link href="/dashboard/shipments/new">
                  <PackagePlus /> New shipment
                </Link>
              </Button>
            )
          }
          className="border-t border-line/60"
        />
      ) : (
        <div className="grid border-t border-line/60 lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* List: horizontal on small screens, a scrolling column beside the map on large ones */}
          {visible.length === 0 ? (
            <EmptyState compact icon={MapPin} title="Nothing in this group" className="lg:border-r lg:border-line/60" />
          ) : (
            <ul
              aria-label="Ongoing shipments"
              className="scrollbar-thin flex snap-x gap-2.5 overflow-x-auto bg-surface-muted/50 p-3 lg:max-h-[34rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-r lg:border-line/60"
            >
              {visible.map((shipment) => (
                <ShipmentListCard
                  key={shipment.id}
                  shipment={shipment}
                  selected={shipment.id === selected?.id}
                  onSelect={() => onSelect(shipment.id)}
                />
              ))}
            </ul>
          )}

          {selected && (
            <div className="relative min-w-0">
              <ShipmentMap
                label={`Route map for ${selected.reference}`}
                geo={geo}
                pins={milestones.pins}
                pinsUnresolved={milestones.unresolved}
                fitPadding={isWide ? { top: 56, right: 64, bottom: 270, left: 56 } : undefined}
                className="h-[24rem] md:h-[34rem]"
              />
              {/* Sits above the Google logo and attribution, which must stay visible. */}
              <DetailsCard
                shipment={selected}
                geo={geo}
                latest={
                  milestones.latest && latestEvent
                    ? { locationName: milestones.latest.locationName, label: latestEvent.label, at: latestEvent.occurredAt }
                    : undefined
                }
                className="m-3 md:absolute md:inset-x-3 md:bottom-8 md:m-0"
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
