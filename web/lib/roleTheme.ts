import { Boxes, Navigation, RadioTower, ShieldCheck, Sparkles, Stamp, type LucideIcon } from "lucide-react";

export type RoleThemeKey = "shipper" | "carrier" | "driver" | "agent" | "admin" | "none";

export const ROLE_EMBLEMS: Record<RoleThemeKey, LucideIcon> = {
  shipper: Boxes,
  carrier: RadioTower,
  driver: Navigation,
  agent: Stamp,
  admin: ShieldCheck,
  none: Sparkles,
};

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
