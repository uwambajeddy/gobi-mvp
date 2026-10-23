import { hasOrgRole } from "./shipmentAccess.service";
import db from "../database/models";

const { organization_members } = db;

/** Drivers belong to carriers: every other organization type has no driver role. */
export const isRoleSupported = (role, companyType) => role !== "driver" || companyType === "transport";

export const UNSUPPORTED_ROLE_MESSAGE = "The driver role is only available in transport organizations.";

/** The type of an organization the caller belongs to (memberships come from `protect`). */
export const companyTypeOf = (req, organizationId) =>
  (req.user.memberships || []).find((m) => m.organizationId === organizationId)?.organization?.companyType;

/**
 * Whether the caller may hand out `role` in the organization. Owner rights
 * can only come from an owner; coordinators may grant every other role.
 */
export const canGrantRole = (req, organizationId, role) =>
  role !== "owner" || hasOrgRole(req, organizationId, ["owner"]);

/** Whether `userId` is currently an active owner of the organization. */
export const isActiveOwner = async (userId, organizationId) =>
  Boolean(
    userId &&
      (await organization_members.count({
        where: { userId, organizationId, role: "owner", active: true },
      })),
  );

/**
 * True when demoting or removing `member` would leave its organization
 * without an active owner.
 */
export const isLastActiveOwner = async (member) => {
  if (!member.active || member.role !== "owner") return false;
  const owners = await organization_members.count({
    where: { organizationId: member.organizationId, role: "owner", active: true },
  });
  return owners <= 1;
};
