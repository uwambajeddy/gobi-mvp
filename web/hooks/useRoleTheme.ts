"use client";

import { useSession } from "next-auth/react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { readActiveOrgId } from "@/lib/axios";
import { ROLE_EMBLEMS, roleThemeFor } from "@/lib/roleTheme";

/**
 * The current workspace's role livery (see lib/roleTheme.ts).
 * Until the memberships query returns, the copy kept in the session decides,
 * so the right colours are on screen from the first paint.
 */
export function useRoleTheme() {
  const { data: session } = useSession();
  const { activeMembership, isLoading } = useActiveOrg();

  const sessionMemberships = session?.user?.memberships ?? [];
  const membership = isLoading
    ? (sessionMemberships.find((m) => String(m.organizationId) === readActiveOrgId()) ?? sessionMemberships[0])
    : activeMembership;

  const key = roleThemeFor(session?.user?.type, membership?.organization?.companyType, membership?.role);
  return { key, Emblem: ROLE_EMBLEMS[key] };
}
