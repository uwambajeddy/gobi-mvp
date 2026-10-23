"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { ATTENTION_STATUSES } from "@/lib/shipments";
import { Shipment } from "@/types";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/feedback";
import { Logo, LogoMark } from "@/components/common/Logo";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { activeHref, buildNav } from "@/components/layout/nav";

/**
 * Sidebar content shared by the desktop rail and the mobile drawer.
 * `collapsed` turns it into an icon-only rail (desktop only).
 */
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

  const user = session?.user;
  const isAdmin = user?.type === "admin";
  const companyType = activeMembership?.organization?.companyType;
  const role = activeMembership?.role;

  const groups = buildNav(user?.type, companyType, role);
  const current = activeHref(groups, pathname);

  // Same cached query as the shipment pages, so this adds no extra request there.
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
    <div className="relative isolate flex h-full flex-col rounded-[inherit] bg-ink text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05)]">
      {/* Survey-map contour lines, fading out toward the top. */}
      <div
        aria-hidden
        className="bg-contours pointer-events-none absolute inset-0 -z-10 opacity-[0.16] [mask-image:linear-gradient(to_top,black_35%,transparent_95%)]"
      />

      {/* Brand */}
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

      {/* Acting-as context */}
      {!isAdmin && (isLoading || memberships.length > 0) && (
        <div className={cn("px-3 pb-3", collapsed && "flex justify-center")}>
          {collapsed ? (
            <span
              title={`${activeMembership?.organization?.name ?? ""} · ${role ?? ""}`}
              className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-white/[0.07] text-white/80"
            >
              <Building2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              <span className="sr-only">Acting as {activeMembership?.organization?.name}</span>
            </span>
          ) : (
            <div className="rounded-inset border border-white/10 bg-white/[0.06] px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
              <p className="text-overline text-white/50">Acting as</p>
              {isLoading ? (
                <div className="mt-1.5 space-y-1.5">
                  <Skeleton className="h-4 w-32 bg-white/10" />
                  <Skeleton className="h-3 w-24 bg-white/10" />
                </div>
              ) : memberships.length === 1 ? (
                <>
                  <p className="mt-0.5 truncate text-label font-semibold text-white">
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
                  className="mt-1.5 h-control-sm text-label"
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

      {/* Navigation */}
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
                          ? "bg-white/[0.09] font-semibold text-white"
                          : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] transition-colors duration-150",
                          isActive
                            ? "bg-primary-500 text-white shadow-brand"
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
                            <span className="mr-1 rounded-full bg-primary-500/20 px-1.5 text-[0.6875rem] font-semibold tabular-nums leading-5 text-primary-200 ring-1 ring-inset ring-primary-400/30">
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

      {/* Account: opens the same menu as the one in the top bar. */}
      <div className="border-t border-white/10 p-3">
        <AccountMenu variant="sidebar" collapsed={collapsed} />
      </div>
    </div>
  );
}
