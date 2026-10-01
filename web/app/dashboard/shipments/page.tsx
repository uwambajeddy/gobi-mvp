"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
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
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { SHIPMENT_STATUS_LABELS } from "@/lib/labels";
import { cn, formatDateTime } from "@/lib/utils";
import { Shipment, ShipmentStatus } from "@/types";

const FILTERS: (ShipmentStatus | "all")[] = [
  "all",
  "draft",
  "submitted",
  "awaiting_documents",
  "documents_complete",
  "execution_assigned",
  "in_transit",
  "arrived",
  "delivered",
  "completed",
  "cancelled",
];

function ShipmentsList() {
  const axios = useAxiosAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ShipmentStatus | "all">(
    (searchParams?.get("status") as ShipmentStatus) || "all",
  );

  const { data: shipments, isLoading } = useQuery({
    queryKey: ["shipments", status],
    queryFn: async () =>
      (
        await axios.get("/api/v1/shipments", {
          params: status === "all" ? {} : { status },
        })
      ).data.data.shipments as Shipment[],
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-dark">Shipments</h1>
      <p className="mt-1 text-sm text-mute">
        Every shipment your organization participates in.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              status === key ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100",
            )}
          >
            {key === "all" ? "All" : SHIPMENT_STATUS_LABELS[key]}
          </button>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-mute">Loading shipments...</p>
          ) : (shipments ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-mute">No shipments found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments!.map((shipment) => (
                  <TableRow key={shipment.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/shipments/${shipment.id}`}
                        className="font-mono text-sm font-medium text-primary hover:underline"
                      >
                        {shipment.reference}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-mute">
                        {shipment.title}
                        {shipment.isCrossBorder && (
                          <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                            <Globe className="h-2.5 w-2.5" /> Cross-border
                          </Badge>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">
                        {shipment.originAddress} → {shipment.destinationAddress}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {shipment.transportOrg?.name ?? "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(shipment.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <ShipmentStatusBadge status={shipment.status} />
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

export default function ShipmentsPage() {
  return (
    <Suspense>
      <ShipmentsList />
    </Suspense>
  );
}
