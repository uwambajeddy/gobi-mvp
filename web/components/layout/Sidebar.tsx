"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { ATTENTION_STATUSES } from "@/lib/shipments";
import { Shipment } from "@/types";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/feedback";
import { Logo, LogoMark } from "@/components/common/Logo";
import { RoleEmblem } from "@/components/common/RoleEmblem";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { activeHref, buildNav } from "@/components/layout/nav";

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { memberships, activeMembership, setActiveOrg, isLoading } = useActiveOrg();
  const { Emblem } = useRoleTheme();

  const user = session?.user;
  const isAdmin = user?.type === "admin";
  const companyType = activeMembership?.organization?.companyType;
  const role = activeMembership?.role;

  const groups = buildNav(user?.type, companyType, role);
  const current = activeHref(groups, pathname);

  const axios = useAxiosAuth();
  const { data: shipments } = useQuery({
    queryKey: ["shipments"],
    enabled: !isAdmin && Boolean(companyType),
    queryFn: async () => (await axios.get("/api/v1/shipments")).data.data.shipments as Shipment[],
  });
  const attention = (shipments ?? []).filter((s) => ATTENTION_STATUSES.includes(s.status)).length;
  const badges: Record<string, { count: number; title: string }> = attention
    ? { "/dashboard/shipments": { count: attention, title: `${attention} need${attention === 1 ? "s" : ""} attention` } }
    : {};

  return (
    <div className="relative isolate flex h-full flex-col rounded-[inherit] bg-role-rail text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05)] transition-colors duration-500">
      <div
        aria-hidden
        className="contours-role pointer-events-none absolute inset-0 -z-10 opacity-[var(--role-contour)] transition-colors duration-500"
      />

      <div className={cn("flex items-center gap-2 px-4 pb-3 pt-4", collapsed ? "flex-col" : "justify-between")}>
        <Link href="/dashboard" onClick={onNavigate} className="focus-ring rounded-[0.75rem] focus-visible:ring-offset-ink" aria-label="Gobi home">
          {collapsed ? <LogoMark inverse /> : <Logo tagline="Shipment coordination" inverse />}
        </Link>
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-offset-ink"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </div>

      {!isAdmin && (isLoading || memberships.length > 0) && (
        <div className={cn("px-3 pb-3", collapsed && "flex justify-center")}>
          {collapsed ? (
            <span
              title={`${activeMembership?.organization?.name ?? ""} · ${role ?? ""}`}
              className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-role-accent/[0.14] text-role-accent ring-1 ring-inset ring-role-accent/30"
            >
              <Emblem className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              <span className="sr-only">Acting as {activeMembership?.organization?.name}</span>
            </span>
          ) : (
            <div className="relative isolate overflow-hidden rounded-inset border border-white/[0.12] bg-gradient-to-br from-white/[0.1] to-white/[0.03] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_8px_24px_-12px_rgb(0_0_0/0.5)] backdrop-blur-md transition-colors duration-500">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-8 -z-10 h-20 w-20 rounded-full bg-role-accent/30 blur-2xl transition-colors duration-500"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
              />
              <RoleEmblem size="sm" className="absolute right-2.5 top-2.5" />
              <p className="text-overline text-white/55">Acting as</p>
              {isLoading ? (
                <div className="mt-1.5 space-y-1.5">
                  <Skeleton className="h-4 w-32 bg-white/10" />
                  <Skeleton className="h-3 w-24 bg-white/10" />
                </div>
              ) : memberships.length === 1 ? (
                <>
                  <p className="mt-0.5 truncate pr-8 text-label font-semibold text-white">
                    {activeMembership?.organization?.name}
                  </p>
                  <p className="truncate text-caption capitalize text-white/60">
                    {COMPANY_TYPE_LABELS[companyType ?? ""] ?? companyType} · {role}
                  </p>
                </>
              ) : (
                <Select
                  aria-label="Acting organization"
                  value={activeMembership?.organizationId ?? ""}
                  onChange={(event) => setActiveOrg(Number(event.target.value))}
                  className="mt-3 h-control-sm text-label"
                >
                  {memberships.map((m) => (
                    <option key={m.organizationId} value={m.organizationId}>
                      {m.organization?.name} ({m.role})
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}
        </div>
      )}

      <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3 [scrollbar-color:rgb(255_255_255/0.18)_transparent]">
        {groups.map((group) => (
          <div key={group.label} className="mt-3 first:mt-1">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
            ) : (
              <p className="mb-1.5 px-2.5 text-overline text-white/50">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive = href === current;
                const badge = badges[href];
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? (badge ? `${label} (${badge.title})` : label) : badge?.title}
                      className={cn(
                        "focus-ring group flex items-center gap-3 rounded-[0.75rem] p-1.5 text-label transition-colors duration-150 focus-visible:ring-offset-ink",
                        collapsed && "justify-center",
                        isActive
                          ? "bg-role-accent/[0.12] font-semibold text-white"
                          : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] transition-colors duration-150",
                          isActive
                            ? "bg-role-accent text-role-on-accent shadow-role"
                            : "text-white/55 group-hover:text-white",
                        )}
                      >
                        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                        {badge && collapsed && (
                          <span
                            aria-hidden
                            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-none text-white ring-2 ring-ink"
                          >
                            {badge.count}
                          </span>
                        )}
                      </span>
                      {collapsed ? (
                        <span className="sr-only">
                          {label}
                          {badge ? `, ${badge.title}` : ""}
                        </span>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {badge && (
                            <span className="mr-1 rounded-full bg-role-accent/25 px-1.5 text-[0.6875rem] font-semibold tabular-nums leading-5 text-white ring-1 ring-inset ring-role-accent/40">
                              {badge.count}
                              <span className="sr-only"> {badge.title}</span>
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <AccountMenu variant="sidebar" collapsed={collapsed} />
      </div>
    </div>
  );
}
