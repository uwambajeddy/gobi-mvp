import {
  Building2,
  FileCheck,
  LayoutDashboard,
  Package,
  PackagePlus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Role-aware navigation. This only decides which links are shown; the API
 * enforces every permission independently.
 */
export const buildNav = (
  userType: string | undefined,
  companyType: string | undefined,
  role: string | undefined,
): NavGroup[] => {
  if (userType === "admin") {
    return [
      {
        label: "Platform",
        items: [
          { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/dashboard/admin/drivers", label: "Driver approvals", icon: ShieldCheck },
          { href: "/dashboard/admin/organizations", label: "Organizations", icon: Building2 },
          { href: "/dashboard/admin/audit", label: "Audit log", icon: ScrollText },
        ],
      },
    ];
  }

  if (!companyType) {
    return [
      { label: "Workspace", items: [{ href: "/dashboard", label: "Get started", icon: Sparkles }] },
    ];
  }

  if (role === "driver") {
    return [
      {
        label: "Workspace",
        items: [
          { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
          { href: "/dashboard/shipments", label: "My assignments", icon: Package },
          { href: "/dashboard/licence", label: "My licence", icon: FileCheck },
        ],
      },
    ];
  }

  const operations: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/shipments", label: "Shipments", icon: Package },
  ];
  if (companyType === "distribution") {
    operations.push({ href: "/dashboard/shipments/new", label: "New shipment", icon: PackagePlus });
  }
  if (companyType === "transport") {
    operations.push({ href: "/dashboard/fleet", label: "Fleet", icon: Truck });
  }

  return [
    { label: "Operations", items: operations },
    {
      label: "Company",
      items: [{ href: "/dashboard/organization", label: "Organization", icon: Building2 }],
    },
  ];
};

/** The single nav item that best matches the path (longest prefix wins). */
export const activeHref = (groups: NavGroup[], pathname: string | null) => {
  if (!pathname) return null;
  const candidates = groups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) =>
      href === "/dashboard" || href === "/dashboard/admin"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    );
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
};

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs for the top bar, derived from the route. */
export const crumbsFor = (pathname: string | null, isDriver: boolean): Crumb[] => {
  const path = pathname ?? "";
  const shipmentsLabel = isDriver ? "My assignments" : "Shipments";
  const admin = { label: "Administration", href: "/dashboard/admin" };

  if (path === "/dashboard/shipments/new") {
    return [{ label: shipmentsLabel, href: "/dashboard/shipments" }, { label: "New shipment" }];
  }
  if (/^\/dashboard\/shipments\/[^/]+$/.test(path)) {
    return [{ label: shipmentsLabel, href: "/dashboard/shipments" }, { label: "Shipment details" }];
  }
  const map: Record<string, Crumb[]> = {
    "/dashboard": [{ label: "Overview" }],
    "/dashboard/shipments": [{ label: shipmentsLabel }],
    "/dashboard/fleet": [{ label: "Fleet" }],
    "/dashboard/organization": [{ label: "Organization" }],
    "/dashboard/licence": [{ label: "My licence" }],
    "/dashboard/profile": [{ label: "Profile" }],
    "/dashboard/admin": [{ label: "Administration" }],
    "/dashboard/admin/drivers": [admin, { label: "Driver approvals" }],
    "/dashboard/admin/organizations": [admin, { label: "Organizations" }],
    "/dashboard/admin/audit": [admin, { label: "Audit log" }],
  };
  return map[path] ?? [{ label: "Dashboard" }];
};
