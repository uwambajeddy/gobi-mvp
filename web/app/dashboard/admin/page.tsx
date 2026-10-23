"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Building2, Package, ScrollText, ShieldCheck, Users } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { BarList } from "@/components/common/BarList";
import { ErrorState, ListSkeleton } from "@/components/common/States";
import { AdminStats } from "@/types";

export default function AdminDashboardPage() {
  const axios = useAxiosAuth();

  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await axios.get("/api/v1/admin/stats")).data.data.stats as AdminStats,
  });

  const cards = [
    {
      label: "Shipments",
      value: stats?.shipments.total ?? 0,
      detail: stats ? `${stats.shipments.active} active · ${stats.shipments.completed} completed` : "",
      icon: Package,
      tone: "brand" as const,
      href: "/dashboard/admin/audit",
    },
    {
      label: "Organizations",
      value: stats?.organizations.total ?? 0,
      detail: "Registered companies",
      icon: Building2,
      tone: "info" as const,
      href: "/dashboard/admin/organizations",
    },
    {
      label: "Driver approvals",
      value: stats?.driverApprovals.pending ?? 0,
      detail: "Licences awaiting review",
      icon: ShieldCheck,
      tone: "warning" as const,
      href: "/dashboard/admin/drivers",
      highlight: (stats?.driverApprovals.pending ?? 0) > 0,
    },
    {
      label: "Open exceptions",
      value: stats?.exceptions.open ?? 0,
      detail: "Blocking shipment closure",
      icon: AlertTriangle,
      tone: "danger" as const,
      href: "/dashboard/admin/audit",
      highlight: (stats?.exceptions.open ?? 0) > 0,
    },
    {
      label: "Users",
      value: stats?.users.total ?? 0,
      detail: "Registered accounts",
      icon: Users,
      tone: "neutral" as const,
      href: "/dashboard/admin/audit",
    },
  ];

  const shipmentsOther = stats ? stats.shipments.total - stats.shipments.active - stats.shipments.completed : 0;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Operational health across every organization on Gobi."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/admin/audit">
              <ScrollText /> Audit log
            </Link>
          </Button>
        }
      />

      {isError ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load platform stats" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} loading={isLoading} />
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Organizations by type</CardTitle>
                  <CardDescription>
                    {stats ? `${stats.organizations.total} organizations` : "Loading..."}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/admin/organizations">
                    View all <ArrowRight />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="px-3 sm:px-3.5">
                {isLoading || !stats ? (
                  <ListSkeleton rows={3} />
                ) : (
                  <BarList
                    unit="organizations"
                    total={stats.organizations.total}
                    items={[
                      { key: "distribution", label: "Distribution (shippers)", value: stats.organizations.distribution },
                      { key: "transport", label: "Transport (carriers)", value: stats.organizations.transport },
                      { key: "clearing", label: "Clearing agents", value: stats.organizations.clearingAgents },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Shipments by state</CardTitle>
                  <CardDescription>{stats ? `${stats.shipments.total} shipments` : "Loading..."}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-3.5">
                {isLoading || !stats ? (
                  <ListSkeleton rows={3} />
                ) : (
                  <BarList
                    total={stats.shipments.total}
                    items={[
                      { key: "active", label: "Active (submitted to delivered)", value: stats.shipments.active },
                      { key: "completed", label: "Completed", value: stats.shipments.completed },
                      { key: "other", label: "Draft or cancelled", value: shipmentsOther },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
