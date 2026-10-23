"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search, SearchX } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterPills } from "@/components/ui/filter-pills";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { CompanyType, Organization } from "@/types";

type Filter = CompanyType | "all";

const TYPE_VARIANT: Record<CompanyType, "default" | "info" | "warning"> = {
  distribution: "default",
  transport: "info",
  clearing_agent: "warning",
};

export default function AdminOrganizationsPage() {
  const axios = useAxiosAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const {
    data: organizations,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () =>
      (await axios.get("/api/v1/admin/organizations")).data.data.organizations as (Organization & {
        createdAt?: string;
      })[],
  });

  const all = useMemo(() => organizations ?? [], [organizations]);
  const searched = all.filter((org) =>
    [org.name, org.contactEmail, org.contactPhone]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const filtered = filter === "all" ? searched : searched.filter((org) => org.companyType === filter);
  const countOf = (type: CompanyType) => searched.filter((org) => org.companyType === type).length;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Organizations"
        description="Every company registered on the platform."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/70 p-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-xs">
            <label htmlFor="org-search" className="sr-only">
              Search organizations
            </label>
            <Input
              id="org-search"
              type="search"
              icon={<Search />}
              placeholder="Search name or contact"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <FilterPills
            label="Filter by company type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: searched.length },
              { value: "distribution", label: COMPANY_TYPE_LABELS.distribution, count: countOf("distribution") },
              { value: "transport", label: COMPANY_TYPE_LABELS.transport, count: countOf("transport") },
              { value: "clearing_agent", label: COMPANY_TYPE_LABELS.clearing_agent, count: countOf("clearing_agent") },
            ]}
          />
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load organizations" />
        ) : isLoading ? (
          <ListSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={all.length === 0 ? Building2 : SearchX}
            title={all.length === 0 ? "No organizations yet" : "No organizations match"}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-sunken text-ink-secondary">
                        <Building2 className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="whitespace-nowrap text-label font-semibold text-ink">{org.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[org.companyType]}>
                      {COMPANY_TYPE_LABELS[org.companyType] ?? org.companyType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-caption text-ink-secondary">{org.contactEmail ?? "-"}</p>
                    {org.contactPhone && <p className="text-caption text-ink-muted">{org.contactPhone}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-caption text-ink-secondary">
                    {formatDate(org.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
