"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Globe, ScrollText, Search, SearchX } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { formatDateTime, formatRelative, fullName } from "@/lib/utils";
import { ActivityLog } from "@/types";

const PAGE_SIZE = 20;

/**
 * The immutable platform audit trail: who did what, when, from where,
 * including gate-override evidence in the metadata column.
 */
export default function AdminAuditPage() {
  const axios = useAxiosAuth();
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(1);

  const {
    data: logs,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await axios.get("/api/v1/admin/activity-logs")).data.data.logs as ActivityLog[],
  });

  const all = useMemo(() => logs ?? [], [logs]);
  const entityTypes = Array.from(new Set(all.map((log) => log.entityType).filter(Boolean))) as string[];

  const needle = query.trim().toLowerCase();
  const filtered = all.filter(
    (log) =>
      (entity === "all" || log.entityType === entity) &&
      (!needle ||
        [log.action, log.description, fullName(log.actor), log.organization?.name, log.actorRole]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(needle))),
  );
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [query, entity]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Every mutating action, immutably recorded: actor, role, organization, entity and evidence. Showing the latest 100 entries."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/70 p-4 sm:px-6 md:flex-row md:items-center">
          <div className="w-full md:max-w-sm">
            <label htmlFor="audit-search" className="sr-only">
              Search the audit log
            </label>
            <Input
              id="audit-search"
              type="search"
              icon={<Search />}
              placeholder="Search action, description, actor or organization"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="w-full md:w-52">
            <label htmlFor="audit-entity" className="sr-only">
              Filter by entity
            </label>
            <Select id="audit-entity" value={entity} onChange={(event) => setEntity(event.target.value)}>
              <option value="all">All entities</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-caption text-ink-muted md:ml-auto" aria-live="polite">
            {isLoading ? "Loading..." : `${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}`}
          </p>
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load the audit trail" />
        ) : isLoading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          all.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No activity recorded yet"
              description="Entries appear as soon as users create or change records."
            />
          ) : (
            <EmptyState icon={SearchX} title="No entries match" description="Try a different search or entity." />
          )
        ) : (
          <>
            <ul className="divide-y divide-line/60">
              {pageRows.map((log) => (
                <li key={log.id} className="flex gap-3 px-5 py-4 sm:px-6">
                  {log.actor ? (
                    <Avatar firstName={log.actor.firstName} lastName={log.actor.lastName} size="sm" tone="neutral" className="mt-0.5" />
                  ) : (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
                      <Globe className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[0.6875rem]">
                          {log.action}
                        </Badge>
                        <p className="text-body text-ink">{log.description}</p>
                      </div>
                      <time
                        dateTime={log.createdAt}
                        title={formatDateTime(log.createdAt)}
                        className="shrink-0 whitespace-nowrap text-caption text-ink-muted"
                      >
                        {formatDateTime(log.createdAt)}
                        <span className="hidden lg:inline"> · {formatRelative(log.createdAt)}</span>
                      </time>
                    </div>
                    <p className="mt-1 text-caption text-ink-muted">
                      <span className="font-medium text-ink-secondary">
                        {log.actor ? fullName(log.actor) : "System"}
                      </span>
                      {log.actorRole ? ` (${log.actorRole})` : ""}
                      {log.organization ? ` · ${log.organization.name}` : ""}
                      {log.entityType ? ` · ${log.entityType}#${log.entityId}` : ""}
                      {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="group mt-2">
                        <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 rounded text-caption font-medium text-primary-600 hover:underline [&::-webkit-details-marker]:hidden">
                          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                          Evidence / metadata
                        </summary>
                        <pre className="scrollbar-thin mt-2 overflow-x-auto rounded-inset border border-line/70 bg-surface-muted p-3 text-[0.6875rem] leading-relaxed text-ink-secondary">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} itemLabel="entries" />
          </>
        )}
      </Card>
    </>
  );
}
