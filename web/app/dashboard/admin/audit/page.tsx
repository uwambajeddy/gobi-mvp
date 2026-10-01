"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { ActivityLog } from "@/types";

/**
 * The immutable platform audit trail: who did what, when, from where,
 * including gate-override evidence in the metadata column.
 */
export default function AdminAuditPage() {
  const axios = useAxiosAuth();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () =>
      (await axios.get("/api/v1/admin/activity-logs")).data.data.logs as ActivityLog[],
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-dark">
        <ScrollText className="h-6 w-6 text-primary" /> Audit log
      </h1>
      <p className="mt-1 text-sm text-mute">
        Every mutating action, immutably recorded: actor, role, organization, entity and evidence.
      </p>

      <Card className="mt-6">
        <CardContent className="divide-y divide-gray-100 p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-mute">Loading audit trail...</p>
          ) : (logs ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-mute">No activity recorded yet.</p>
          ) : (
            logs!.map((log) => (
              <div key={log.id} className="px-6 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {log.action}
                    </Badge>
                    <p className="text-sm">{log.description}</p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-mute">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-mute">
                  {log.actor
                    ? `${log.actor.firstName} ${log.actor.lastName}`
                    : "System"}
                  {log.actorRole ? ` (${log.actorRole})` : ""}
                  {log.organization ? ` · ${log.organization.name}` : ""}
                  {log.entityType ? ` · ${log.entityType}#${log.entityId}` : ""}
                  {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                </p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs font-medium text-primary">
                      Evidence / metadata
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-gray-50 p-2.5 text-[11px] leading-relaxed text-gray-700">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
