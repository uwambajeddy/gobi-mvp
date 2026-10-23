"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, ChevronsUpDown, LogOut, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

/**
 * The signed-in person's menu (Profile, Sign out), shown in the top bar and at
 * the foot of the sidebar; both open the same menu.
 */
export function AccountMenu({
  variant,
  collapsed = false,
  className,
}: {
  variant: "sidebar" | "topbar";
  /** Sidebar only: the icon rail shows just the avatar. */
  collapsed?: boolean;
  className?: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const { activeMembership } = useActiveOrg();

  const user = session?.user;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const roleLine =
    user?.type === "admin"
      ? "Platform admin"
      : activeMembership
        ? `${COMPANY_TYPE_LABELS[activeMembership.organization?.companyType ?? ""] ?? ""} · ${activeMembership.role}`
        : "No organization yet";

  const trigger =
    variant === "topbar" ? (
      <span className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-white/90 md:pr-3">
        <Avatar firstName={user?.firstName} lastName={user?.lastName} size="sm" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[10rem] truncate text-label font-semibold text-ink">{name}</span>
          <span className="block max-w-[10rem] truncate text-[0.6875rem] capitalize text-ink-muted">{roleLine}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-ink-muted md:block" aria-hidden />
      </span>
    ) : (
      <span
        className={cn(
          "flex items-center gap-2.5 rounded-inset p-1.5 text-left transition-colors hover:bg-white/[0.06]",
          collapsed && "justify-center",
        )}
      >
        <Avatar firstName={user?.firstName} lastName={user?.lastName} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-label font-semibold text-white">{name}</span>
              <span className="block truncate text-caption text-white/55">{user?.email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
          </>
        )}
      </span>
    );

  return (
    <DropdownMenu
      className={className}
      triggerLabel="Account menu"
      triggerClassName={cn(variant === "sidebar" && "block w-full rounded-inset focus-visible:ring-offset-ink")}
      side={variant === "sidebar" ? "top" : "bottom"}
      align={variant === "sidebar" ? "start" : "end"}
      trigger={trigger}
      header={
        <div className="min-w-0">
          <p className="truncate text-label font-semibold text-ink">{name}</p>
          <p className="truncate text-caption text-ink-muted">{user?.email}</p>
          <p className="mt-0.5 truncate text-caption capitalize text-ink-muted">{roleLine}</p>
        </div>
      }
      items={[
        { label: "Profile", icon: User, onSelect: () => router.push("/dashboard/profile") },
        { label: "Sign out", icon: LogOut, tone: "danger", onSelect: () => signOut({ callbackUrl: "/" }) },
      ]}
    />
  );
}
