import { Boxes, Navigation, RadioTower, ShieldCheck, Sparkles, Stamp, type LucideIcon } from "lucide-react";

/**
 * Role livery. On a depot floor you tell a driver from a dispatcher by the
 * colour of their vest; each Gobi workspace likewise wears its role's colour
 * on the chrome, so the role is obvious at a glance. The colours live in
 * app/globals.css under `[data-role]`; this decides which one applies.
 */
export type RoleThemeKey = "shipper" | "carrier" | "driver" | "agent" | "admin" | "none";

/** The role's mark, shown on its accent tile (sidebar and dashboard header). */
export const ROLE_EMBLEMS: Record<RoleThemeKey, LucideIcon> = {
  shipper: Boxes,
  carrier: RadioTower,
  driver: Navigation,
  agent: Stamp,
  admin: ShieldCheck,
  none: Sparkles,
};

/**
 * Drivers wear their own colour whatever their carrier; everyone else takes
 * their organization's: shipper, carrier operations or clearing agent.
 */
export const roleThemeFor = (
  userType: string | undefined,
  companyType: string | undefined,
  role: string | undefined,
): RoleThemeKey => {
  if (userType === "admin") return "admin";
  if (role === "driver") return "driver";
  if (companyType === "distribution") return "shipper";
  if (companyType === "transport") return "carrier";
  if (companyType === "clearing_agent") return "agent";
  return "none";
};
