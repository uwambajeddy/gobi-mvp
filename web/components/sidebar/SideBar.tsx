"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Building2,
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  ScrollText,
  ShieldCheck,
  Truck,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { useActiveOrg } from "@/hooks/useActiveOrg";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const buildNav = (
  userType: string | undefined,
  companyType: string | undefined,
  role: string | undefined,
): NavItem[] => {
  if (userType === "admin") {
    return [
      { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/admin/drivers", label: "Driver approvals", icon: ShieldCheck },
      { href: "/dashboard/admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/dashboard/admin/audit", label: "Audit log", icon: ScrollText },
      { href: "/dashboard/profile", label: "Profile", icon: User },
    ];
  }

  if (!companyType) {
    return [
      { href: "/dashboard", label: "Get started", icon: LayoutDashboard },
      { href: "/dashboard/profile", label: "Profile", icon: User },
    ];
  }

  if (role === "driver") {
    return [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/shipments", label: "My assignments", icon: Package },
      { href: "/dashboard/licence", label: "My licence", icon: FileCheck },
      { href: "/dashboard/profile", label: "Profile", icon: User },
    ];
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/shipments", label: "Shipments", icon: Package },
  ];

  if (companyType === "distribution") {
    items.push({ href: "/dashboard/shipments/new", label: "New shipment", icon: Plus });
  }
  if (companyType === "transport") {
    items.push({ href: "/dashboard/fleet", label: "Fleet", icon: Truck });
  }

  items.push(
    { href: "/dashboard/organization", label: "Organization", icon: Building2 },
    { href: "/dashboard/profile", label: "Profile", icon: User },
  );

  return items;
};

export default function SideBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { memberships, activeMembership, setActiveOrg } = useActiveOrg();

  const userType = session?.user?.type;
  const companyType = activeMembership?.organization?.companyType;
  const role = activeMembership?.role;

  const items = buildNav(userType, companyType, role);

  const orgSwitcher = userType !== "admin" && memberships.length > 0 && (
    <div className="border-b border-gray-100 px-4 py-3">
      <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Acting as
      </p>
      {memberships.length === 1 ? (
        <div className="px-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {activeMembership?.organization?.name}
          </p>
          <p className="text-xs capitalize text-gray-500">
            {COMPANY_TYPE_LABELS[companyType ?? ""] ?? companyType} · {role}
          </p>
        </div>
      ) : (
        <select
          value={activeMembership?.organizationId ?? ""}
          onChange={(event) => setActiveOrg(Number(event.target.value))}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          {memberships.map((m) => (
            <option key={m.organizationId} value={m.organizationId}>
              {m.organization?.name} ({m.role})
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/dashboard" || href === "/dashboard/admin"
            ? pathname === href
            : pathname?.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary-100 text-primary-800"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-gray-100 p-4">
      <div className="mb-3 px-3">
        <p className="truncate text-sm font-medium text-gray-900">
          {session?.user?.firstName} {session?.user?.lastName}
        </p>
        <p className="truncate text-xs text-gray-500">
          {userType === "admin" ? "Platform admin" : session?.user?.email}
        </p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          Gobi
        </Link>
        <button
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle menu"
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-b border-gray-200 bg-white lg:hidden">
          {orgSwitcher}
          {nav}
          {footer}
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="border-b border-gray-100 p-6">
          <Link href="/dashboard" className="text-2xl font-bold text-primary">
            Gobi
          </Link>
          <p className="mt-1 text-xs text-gray-500">Shipment coordination</p>
        </div>
        {orgSwitcher}
        {nav}
        {footer}
      </aside>
    </>
  );
}
