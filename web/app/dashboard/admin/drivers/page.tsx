"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { handleApiError } from "@/lib/handleApiError";
import { cn, formatDateTime } from "@/lib/utils";
import { DriverProfile } from "@/types";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

export default function AdminDriversPage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");

  const { data: profiles, isLoading } = useQuery({
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

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-dark">Driver approvals</h1>
      <p className="mt-1 text-sm text-mute">
        Verify licences before drivers can be assigned to shipments.
      </p>

      <div className="mt-6 flex gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              filter === key ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100",
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-mute">Loading driver profiles...</p>
          ) : (profiles ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-mute">No {filter === "all" ? "" : `${filter} `}profiles.</p>
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
                {profiles!.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <p className="font-medium">
                        {profile.user?.firstName} {profile.user?.lastName}
                      </p>
                      <p className="text-xs text-mute">{profile.user?.email}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{profile.licenceNumber}</TableCell>
                    <TableCell className="text-sm">{profile.licenceExpiresAt ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(profile.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          profile.status === "approved"
                            ? "success"
                            : profile.status === "rejected"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {profile.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {profile.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: profile.id, status: "approved" })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: profile.id, status: "rejected" })}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
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
