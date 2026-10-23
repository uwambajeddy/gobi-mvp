"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, Menu, PackagePlus } from "lucide-react";

import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/common/Logo";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { crumbsFor } from "@/components/layout/nav";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { activeMembership } = useActiveOrg();

  const user = session?.user;
  const isAdmin = user?.type === "admin";
  const isDriver = activeMembership?.role === "driver";
  const crumbs = crumbsFor(pathname, isDriver);
  // Hidden where the page header already offers the same action.
  const canCreateShipment =
    !isAdmin &&
    activeMembership?.organization?.companyType === "distribution" &&
    !["/dashboard/shipments", "/dashboard/shipments/new"].includes(pathname ?? "");

  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70">
      <div className="mx-auto flex h-topbar w-full max-w-content items-center gap-3 px-4 md:px-6 xl:px-8">
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onOpenMenu}>
          <Menu />
        </Button>
        <Link href="/dashboard" className="focus-ring rounded-[0.75rem] lg:hidden" aria-label="Gobi home">
          <LogoMark className="h-7" />
        </Link>

        <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
          <ol className="flex items-center gap-1.5 text-label">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden />}
                  {crumb.href && !last ? (
                    <Link href={crumb.href} className="focus-ring truncate rounded text-ink-muted hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className="truncate font-semibold text-ink">
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {canCreateShipment && (
            <Button asChild size="sm" className="max-sm:w-control-sm max-sm:px-0">
              <Link href="/dashboard/shipments/new" aria-label="New shipment">
                <PackagePlus />
                <span className="max-sm:sr-only">New shipment</span>
              </Link>
            </Button>
          )}
          <AccountMenu variant="topbar" />
        </div>
      </div>
    </header>
  );
}
