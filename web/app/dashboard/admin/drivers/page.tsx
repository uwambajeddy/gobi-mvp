"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Check, ShieldCheck, X } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DriverStatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { cn, formatDate, formatDateTime, fullName } from "@/lib/utils";
import { DriverProfile } from "@/types";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;
type Filter = (typeof FILTERS)[number];

const isExpired = (date?: string | null) => Boolean(date && new Date(date) < new Date());

export default function AdminDriversPage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");

  const {
    data: profiles,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-drivers", filter],
    queryFn: async () =>
      (
        await axios.get("/api/v1/admin/drivers", {
          params: filter === "all" ? {} : { status: filter },
        })
      ).data.data.driverProfiles as DriverProfile[],
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      axios.patch(`/api/v1/admin/drivers/${id}`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "Driver approved." : "Driver rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: handleApiError,
  });

  const list = profiles ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Driver approvals"
        description="Verify licences before drivers can be assigned to shipments. Approval feeds the compliance gate."
      />

      <Tabs
        idBase="drivers"
        label="Filter driver profiles by status"
        value={filter}
        onValueChange={setFilter}
        className="mb-4 w-fit max-w-full"
        items={FILTERS.map((key) => ({ value: key, label: key === "all" ? "All" : key[0].toUpperCase() + key.slice(1) }))}
      />

      <Card className="overflow-hidden" role="tabpanel" id={`drivers-panel-${filter}`} aria-labelledby={`drivers-tab-${filter}`}>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load driver profiles" />
        ) : isLoading ? (
          <ListSkeleton rows={4} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={`No ${filter === "all" ? "" : `${filter} `}profiles`}
            description={filter === "pending" ? "Every submitted licence has been reviewed." : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((profile) => {
                const expired = isExpired(profile.licenceExpiresAt);
                const pending = review.isPending && review.variables?.id === profile.id;
                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar firstName={profile.user?.firstName} lastName={profile.user?.lastName} tone="neutral" />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-label font-semibold text-ink">{fullName(profile.user)}</p>
                          <p className="text-caption text-ink-muted">{profile.user?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-caption text-ink">{profile.licenceNumber}</TableCell>
                    <TableCell className={cn("whitespace-nowrap text-caption", expired ? "font-semibold text-danger-fg" : "text-ink")}>
                      {formatDate(profile.licenceExpiresAt)}
                      {expired && " (expired)"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-caption text-ink-secondary">
                      {formatDateTime(profile.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DriverStatusBadge status={profile.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {profile.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={review.isPending}
                            loading={pending && review.variables?.status === "approved"}
                            onClick={() => review.mutate({ id: profile.id, status: "approved" })}
                          >
                            <Check /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive-outline"
                            disabled={review.isPending}
                            loading={pending && review.variables?.status === "rejected"}
                            onClick={() => review.mutate({ id: profile.id, status: "rejected" })}
                          >
                            <X /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
