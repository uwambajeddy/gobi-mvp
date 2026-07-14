"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, Package, ShieldCheck, Users } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Card, CardContent } from "@/components/ui/card";
import { AdminStats } from "@/types";

export default function AdminDashboardPage() {
  const axios = useAxiosAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await axios.get("/api/v1/admin/stats")).data.data.stats as AdminStats,
  });

  const cards = stats
    ? [
        {
          label: "Shipments",
          value: stats.shipments.total,
          detail: `${stats.shipments.active} active • ${stats.shipments.completed} completed`,
          icon: Package,
          href: "/dashboard/admin/audit",
        },
        {
          label: "Organizations",
          value: stats.organizations.total,
          detail: `${stats.organizations.distribution} distribution • ${stats.organizations.transport} transport • ${stats.organizations.clearingAgents} agents`,
          icon: Building2,
          href: "/dashboard/admin/organizations",
        },
        {
          label: "Pending driver approvals",
          value: stats.driverApprovals.pending,
          detail: "Licences awaiting review",
          icon: ShieldCheck,
          href: "/dashboard/admin/drivers",
          highlight: stats.driverApprovals.pending > 0,
        },
        {
          label: "Open exceptions",
          value: stats.exceptions.open,
          detail: "Blocking shipment closure",
          icon: AlertTriangle,
          href: "/dashboard/admin/audit",
          highlight: stats.exceptions.open > 0,
        },
        {
          label: "Users",
          value: stats.users.total,
          detail: "Registered accounts",
          icon: Users,
          href: "/dashboard/admin/audit",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-dark">Platform administration</h1>
      <p className="mt-1 text-sm text-mute">Operational health at a glance.</p>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-mute">Loading stats...</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ label, value, detail, icon: Icon, href, highlight }) => (
            <Link key={label} href={href}>
              <Card
                className={`h-full transition-shadow hover:shadow-md ${
                  highlight ? "border-amber-300 bg-amber-50" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-3xl font-bold text-dark">{value}</span>
                  </div>
                  <p className="mt-4 font-medium text-dark">{label}</p>
                  <p className="mt-0.5 text-xs text-mute">{detail}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
