"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { ACTIVE_ORG_COOKIE } from "@/lib/axios";
import { Membership } from "@/types";

const readCookie = (): number | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACTIVE_ORG_COOKIE}=`));
  const value = match ? Number(decodeURIComponent(match.split("=")[1])) : NaN;
  return Number.isNaN(value) ? null : value;
};

const writeCookie = (orgId: number) => {
  document.cookie = `${ACTIVE_ORG_COOKIE}=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}`;
};

/**
 * The caller's organization memberships (fresh from the API) and the
 * currently selected acting organization, persisted in a cookie that the
 * Axios instance forwards as `x-organization-id`.
 */
export function useActiveOrg() {
  const axios = useAxiosAuth();
  const { status } = useSession();
  const [activeOrgId, setActiveOrgIdState] = useState<number | null>(readCookie);

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["my-memberships"],
    enabled: status === "authenticated",
    queryFn: async () =>
      (await axios.get("/api/v1/organizations/mine")).data.data.memberships as Membership[],
  });

  // Default to the first membership when nothing is selected yet.
  useEffect(() => {
    if (!isLoading && memberships.length > 0) {
      const valid = memberships.some((m) => m.organizationId === activeOrgId);
      if (!valid) {
        writeCookie(memberships[0].organizationId);
        setActiveOrgIdState(memberships[0].organizationId);
      }
    }
  }, [isLoading, memberships, activeOrgId]);

  const setActiveOrg = useCallback((orgId: number) => {
    writeCookie(orgId);
    setActiveOrgIdState(orgId);
    // Org context changes what every query returns; simplest correct reset:
    window.location.reload();
  }, []);

  const activeMembership =
    memberships.find((m) => m.organizationId === activeOrgId) ?? memberships[0] ?? null;

  return { memberships, activeMembership, setActiveOrg, isLoading };
}
