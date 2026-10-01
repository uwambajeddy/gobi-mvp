"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Package, Plus } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShipmentStatusBadge } from "@/components/common/StatusBadge";
import { handleApiError } from "@/lib/handleApiError";
import { COMPANY_TYPE_LABELS, SHIPMENT_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { Shipment, ShipmentStatus } from "@/types";

/** Empty state for users without an organization: create one inline. */
function CreateOrgCard() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [companyType, setCompanyType] = useState("distribution");

  const createOrg = useMutation({
    mutationFn: async () =>
      axios.post("/api/v1/organizations", { name, companyType }),
    onSuccess: () => {
      toast.success("Organization created. You are the owner.");
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
    },
    onError: handleApiError,
  });

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" /> Set up your organization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-mute">
          Gobi is an operational workspace for logistics companies. Create your organization to
          start coordinating shipments, or ask an existing organization owner to add your account
          ({/* email hint */}the email you registered with).
        </p>
        <div className="space-y-2">
          <Label htmlFor="orgName">Organization name</Label>
          <Input
            id="orgName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Kigali Distribution Ltd"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyType">Company type</Label>
          <select
            id="companyType"
            value={companyType}
            onChange={(event) => setCompanyType(event.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(COMPANY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-mute">
            Distribution companies create and track shipments. Transport companies execute them.
            Clearing agents handle customs milestones.
          </p>
        </div>
        <Button
          className="w-full"
          disabled={name.trim().length < 2 || createOrg.isPending}
          onClick={() => createOrg.mutate()}
        >
          {createOrg.isPending ? "Creating..." : "Create organization"}
        </Button>
      </CardContent>
    </Card>
  );
}

function OrgHome() {
  const axios = useAxiosAuth();
  const { activeMembership } = useActiveOrg();

  const { data: shipments } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () =>
      (await axios.get("/api/v1/shipments")).data.data.shipments as Shipment[],
  });

  const companyType = activeMembership?.organization?.companyType;
  const isShipper = companyType === "distribution";

  const active = (shipments ?? []).filter(
    (s) => !["completed", "cancelled", "draft"].includes(s.status),
  );
  const needsAttention = (shipments ?? []).filter((s) =>
    ["submitted", "awaiting_documents", "arrived", "delivered"].includes(s.status),
  );

  const countsByStatus = (shipments ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Status summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["awaiting_documents", "Awaiting documents"],
            ["execution_assigned", "Ready to move"],
            ["in_transit", "In transit"],
            ["delivered", "Awaiting confirmation"],
          ] as [ShipmentStatus, string][]
        ).map(([status, label]) => (
          <Link key={status} href={`/dashboard/shipments?status=${status}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <p className="text-3xl font-bold text-dark">{countsByStatus[status] ?? 0}</p>
                <p className="mt-1 text-sm text-mute">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {isShipper && (
        <Card className="border-primary-200 bg-primary-50">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium text-dark">Move new cargo</p>
              <p className="text-sm text-mute">
                Create a shipment request with packages, route and recipient.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/shipments/new">
                <Plus className="h-4 w-4" /> New shipment
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Attention queue */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Needs attention ({needsAttention.length})</CardTitle>
          <Button variant="link" asChild>
            <Link href="/dashboard/shipments">
              All shipments <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {needsAttention.length === 0 ? (
            <p className="py-8 text-center text-sm text-mute">
              Nothing waiting on you. {active.length} shipment(s) progressing normally.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {needsAttention.slice(0, 6).map((shipment) => (
                <li key={shipment.id}>
                  <Link
                    href={`/dashboard/shipments/${shipment.id}`}
                    className="flex items-center justify-between gap-4 py-3 hover:bg-gray-50/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Package className="h-4 w-4 shrink-0 text-mute" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          <span className="font-mono text-xs text-mute">{shipment.reference}</span>{" "}
                          {shipment.title}
                        </p>
                        <p className="text-xs text-mute">
                          {SHIPMENT_STATUS_LABELS[shipment.status]} ·{" "}
                          {formatDateTime(shipment.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <ShipmentStatusBadge status={shipment.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { memberships, activeMembership, isLoading } = useActiveOrg();

  const userType = session?.user?.type;

  useEffect(() => {
    if (userType === "admin") router.replace("/dashboard/admin");
  }, [userType, router]);

  if (status === "loading" || userType === "admin" || isLoading) {
    return <p className="py-16 text-center text-sm text-mute">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-dark">Hi {session?.user?.firstName} 👋</h1>
      <p className="mt-1 text-sm text-mute">
        {activeMembership
          ? `${activeMembership.organization?.name}: operational overview.`
          : "Let's get you set up."}
      </p>
      <div className="mt-8">{memberships.length === 0 ? <CreateOrgCard /> : <OrgHome />}</div>
    </div>
  );
}
