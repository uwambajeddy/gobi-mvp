import { hasOrgRole } from "./shipmentAccess.service";
import db from "../database/models";

const { organization_members } = db;

export const isRoleSupported = (role, companyType) => role !== "driver" || companyType === "transport";

export const UNSUPPORTED_ROLE_MESSAGE = "The driver role is only available in transport organizations.";

export const companyTypeOf = (req, organizationId) =>
  (req.user.memberships || []).find((m) => m.organizationId === organizationId)?.organization?.companyType;

/**
 * Whether the caller may hand out `role` in the organization. Owner rights
 * can only come from an owner; coordinators may grant every other role.
 */
export const canGrantRole = (req, organizationId, role) =>
  role !== "owner" || hasOrgRole(req, organizationId, ["owner"]);

export const isActiveOwner = async (userId, organizationId) =>
  Boolean(
    userId &&
      (await organization_members.count({
        where: { userId, organizationId, role: "owner", active: true },
      })),
  );

export const isLastActiveOwner = async (member) => {
  if (!member.active || member.role !== "owner") return false;
  const owners = await organization_members.count({
    where: { organizationId: member.organizationId, role: "owner", active: true },
  });
  return owners <= 1;
};
