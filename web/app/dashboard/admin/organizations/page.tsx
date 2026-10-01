"use client";

import { useQuery } from "@tanstack/react-query";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { Organization } from "@/types";

export default function AdminOrganizationsPage() {
  const axios = useAxiosAuth();

  const { data: organizations, isLoading } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () =>
      (await axios.get("/api/v1/admin/organizations")).data.data
        .organizations as (Organization & { createdAt?: string })[],
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-dark">Organizations</h1>
      <p className="mt-1 text-sm text-mute">Every company registered on the platform.</p>

      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-mute">Loading organizations...</p>
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
                {(organizations ?? []).map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {COMPANY_TYPE_LABELS[org.companyType] ?? org.companyType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-mute">
                      {org.contactEmail ?? "-"}
                      {org.contactPhone ? ` · ${org.contactPhone}` : ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(org.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
