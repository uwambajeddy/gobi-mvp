"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Globe,
  Inbox,
  Layers,
  Loader,
  PackagePlus,
  Search,
  SearchX,
} from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterPills } from "@/components/ui/filter-pills";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState } from "@/components/common/States";
import { SHIPMENT_STATUS_LABELS } from "@/lib/labels";
import {
  ACTIVE_STATUSES,
  ATTENTION_STATUSES,
  FILTER_STATUSES,
  countByStatus,
  matchesSearch,
} from "@/lib/shipments";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Shipment, ShipmentStatus } from "@/types";

const PAGE_SIZE = 10;
type Filter = ShipmentStatus | "all";

function Route({ shipment }: { shipment: Shipment }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-1.5 flex flex-col items-center" aria-hidden>
        <span className="h-2 w-2 rounded-full border-2 border-primary-500" />
        <span className="my-0.5 h-3 w-px bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-primary-500" />
      </span>
      <span className="min-w-0 text-caption leading-5">
        <span className="block truncate text-ink">{shipment.originAddress}</span>
        <span className="block truncate text-ink-muted">{shipment.destinationAddress}</span>
      </span>
    </div>
  );
}

function ShipmentsList() {
  const axios = useAxiosAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeMembership } = useActiveOrg();

  const initial = searchParams?.get("status") as ShipmentStatus | null;
  const [status, setStatus] = useState<Filter>(
    initial && (FILTER_STATUSES.includes(initial) || initial === "quote_approved") ? initial : "all",
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const isDriver = activeMembership?.role === "driver";
  const canCreate = activeMembership?.organization?.companyType === "distribution";

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

  const all = useMemo(() => shipments ?? [], [shipments]);
  const counts = countByStatus(all);
  const searched = useMemo(() => all.filter((s) => matchesSearch(s, query)), [all, query]);
  const filtered = status === "all" ? searched : searched.filter((s) => s.status === status);
  const searchedCounts = countByStatus(searched);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [status, query]);

  const changeStatus = (next: Filter) => {
    setStatus(next);
    router.replace(next === "all" ? "/dashboard/shipments" : `/dashboard/shipments?status=${next}`, {
      scroll: false,
    });
  };

  const filterOptions = [
    { value: "all" as Filter, label: "All", count: searched.length },
    ...FILTER_STATUSES.map((s) => ({
      value: s as Filter,
      label: SHIPMENT_STATUS_LABELS[s],
      count: searchedCounts[s] ?? 0,
    })),
  ];

  const hasFilters = status !== "all" || query.trim() !== "";
  const open = (id: number) => router.push(`/dashboard/shipments/${id}`);

  return (
    <>
      <PageHeader
        title={isDriver ? "My assignments" : "Shipments"}
        description={
          isDriver
            ? "Shipments assigned to you. Open one to record milestones or capture proof of delivery."
            : "Every shipment your organization takes part in, as shipper, carrier or clearing agent."
        }
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/dashboard/shipments/new">
                <PackagePlus /> New shipment
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total" value={all.length} detail="All statuses" icon={Layers} loading={isLoading} />
        <StatCard
          label="In progress"
          value={all.filter((s) => ACTIVE_STATUSES.includes(s.status)).length}
          detail="Submitted to delivered"
          icon={Loader}
          tone="info"
          loading={isLoading}
        />
        <StatCard
          label="Needs attention"
          value={all.filter((s) => ATTENTION_STATUSES.includes(s.status)).length}
          detail="Waiting on a party to act"
          icon={Inbox}
          tone="warning"
          loading={isLoading}
        />
        <StatCard
          label="Completed"
          value={counts.completed ?? 0}
          detail="Closed after confirmation"
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
        />
      </div>

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="space-y-3 border-b border-line/70 p-4 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-sm">
              <label htmlFor="shipment-search" className="sr-only">
                Search shipments
              </label>
              <Input
                id="shipment-search"
                type="search"
                icon={<Search />}
                placeholder="Search reference, title, place or company"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p className="text-caption text-ink-muted" aria-live="polite">
              {isLoading
                ? "Loading shipments..."
                : `${filtered.length} shipment${filtered.length === 1 ? "" : "s"}${hasFilters ? " match" : ""}`}
            </p>
          </div>
          <FilterPills label="Filter by status" options={filterOptions} value={status} onChange={changeStatus} />
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load shipments" />
        ) : isLoading ? (
          <div className="divide-y divide-line/60" aria-busy="true" aria-label="Loading shipments">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4">
                <div className="w-48 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="hidden h-8 flex-1 md:block" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No shipments match"
              description="Try a different search term or status filter."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    changeStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No shipments yet"
              description={
                canCreate
                  ? "Create a shipment to request quotes from carriers."
                  : "Shipments appear here once your organization is assigned to one."
              }
              action={
                canCreate && (
                  <Button asChild size="sm">
                    <Link href="/dashboard/shipments/new">
                      <PackagePlus /> New shipment
                    </Link>
                  </Button>
                )
              }
            />
          )
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="hidden lg:table-cell">Parties</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="group cursor-pointer"
                      onClick={() => open(shipment.id)}
                    >
                      <TableCell className="max-w-[17rem]">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/shipments/${shipment.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="focus-ring rounded font-mono text-caption font-medium text-primary-600 hover:underline"
                          >
                            {shipment.reference}
                          </Link>
                          {shipment.isCrossBorder && (
                            <Badge variant="info" className="px-1.5 py-0 text-[0.6875rem]">
                              <Globe className="h-3 w-3" aria-hidden /> Cross-border
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-label font-semibold text-ink">{shipment.title}</p>
                      </TableCell>
                      <TableCell className="max-w-[14rem]">
                        <Route shipment={shipment} />
                      </TableCell>
                      <TableCell className="hidden max-w-[13rem] lg:table-cell">
                        <p className="truncate text-caption text-ink">
                          <span className="text-ink-muted">Shipper </span>
                          {shipment.distributionOrg?.name ?? "-"}
                        </p>
                        <p className="truncate text-caption text-ink">
                          <span className="text-ink-muted">Carrier </span>
                          {shipment.transportOrg?.name ?? (
                            <span className="text-ink-subtle">Not assigned</span>
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <ShipmentStatusBadge status={shipment.status} />
                        <p className="mt-1 text-caption text-ink-muted" title={formatDateTime(shipment.updatedAt)}>
                          Updated {formatRelative(shipment.updatedAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <ChevronRight
                          className="h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink-muted"
                          aria-hidden
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line/60 md:hidden">
              {pageRows.map((shipment) => (
                <li key={shipment.id}>
                  <Link
                    href={`/dashboard/shipments/${shipment.id}`}
                    className="focus-ring block px-4 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-mono text-caption text-primary-600">
                          {shipment.reference}
                          {shipment.isCrossBorder && <Globe className="h-3.5 w-3.5 text-info-fg" aria-label="Cross-border" />}
                        </p>
                        <p className="mt-0.5 text-label font-semibold text-ink">{shipment.title}</p>
                      </div>
                      <ShipmentStatusBadge status={shipment.status} />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <Route shipment={shipment} />
                      <span className="flex shrink-0 items-center gap-1 text-caption text-ink-muted">
                        {formatRelative(shipment.updatedAt)} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
              itemLabel="shipments"
            />
          </>
        )}
      </Card>
    </>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense>
      <ShipmentsList />
    </Suspense>
  );
}
