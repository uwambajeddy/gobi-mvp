import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse, deleteResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { hasOrgRole } from "../services/shipmentAccess.service";
import {
  canGrantRole,
  companyTypeOf,
  isLastActiveOwner,
  isRoleSupported,
  UNSUPPORTED_ROLE_MESSAGE,
} from "../services/organizationAccess.service";
import { notifyInvitation, notifyMemberAdded } from "../services/notifications.service";
import { createOrRefreshInvitation, invitationInclude } from "../services/invitations.service";
import db from "../database/models";

const { ok, created, badRequest, notFound, forbidden, conflict } = statusCodes;
const { organizations, organization_members, organization_invitations, users } = db;

const memberInclude = [
  {
    model: users,
    as: "user",
    attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
  },
];

/**
 * POST /api/v1/organizations: create an organization; creator becomes owner.
 */
export const createOrganization = catchAsync(async (req, res) => {
  const { name, companyType, contactEmail, contactPhone, address } = req.body;

  const organization = await organizations.create({
    name,
    companyType,
    contactEmail,
    contactPhone,
    address,
    createdByUserId: req.user.id,
  });

  await organization_members.create({
    userId: req.user.id,
    organizationId: organization.id,
    role: "owner",
  });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.CREATE_ORGANIZATION,
    entityType: "organizations",
    entityId: organization.id,
    description: `Created ${companyType} organization "${name}"`,
  });

  return successResponse(res, created, { organization });
});

/**
 * GET /api/v1/organizations: directory, filterable by company type.
 * Used by shippers to pick carriers and clearing agents.
 */
export const listOrganizations = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.companyType) where.companyType = req.query.companyType;

  const allOrganizations = await organizations.findAll({
    where,
    order: [["name", "ASC"]],
  });

  return successResponse(res, ok, { organizations: allOrganizations });
});

/**
 * GET /api/v1/organizations/mine: organizations the caller belongs to.
 */
export const getMyOrganizations = catchAsync(async (req, res) => {
  const memberships = await organization_members.findAll({
    where: { userId: req.user.id, active: true },
    include: [{ model: organizations, as: "organization" }],
  });

  return successResponse(res, ok, { memberships });
});

/**
 * GET /api/v1/organizations/:id/members
 */
export const listMembers = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);

  const isMember = (req.user.memberships || []).some(
    (m) => m.organizationId === organizationId,
  );
  if (!isMember && req.user.type !== "admin") {
    return next(new AppError("You are not a member of this organization.", forbidden));
  }

  const members = await organization_members.findAll({
    where: { organizationId, active: true },
    include: memberInclude,
    order: [["createdAt", "ASC"]],
  });

  return successResponse(res, ok, { members });
});

/**
 * POST /api/v1/organizations/:id/members: add someone by email.
 * Owner/coordinator only; only an owner can add another owner, and only a
 * transport organization can have drivers. An existing user is added straight
 * away (`member`), except as a driver; an email without an account, or anyone
 * asked to be a driver, gets an emailed invitation (`invitation`) to accept.
 * Repeating it for an open invitation resends it.
 */
export const addMember = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);
  const { email, role } = req.body;

  if (!hasOrgRole(req, organizationId, ["owner", "coordinator"])) {
    return next(new AppError("Only owners and coordinators can add members.", forbidden));
  }
  if (!canGrantRole(req, organizationId, role)) {
    return next(new AppError("Only an owner can add another owner.", forbidden));
  }
  if (!isRoleSupported(role, companyTypeOf(req, organizationId))) {
    return next(new AppError(UNSUPPORTED_ROLE_MESSAGE, badRequest));
  }

  const user = await users.findOne({ where: { email } });
  const existing = user
    ? await organization_members.findOne({ where: { userId: user.id, organizationId } })
    : null;
  if (existing && existing.active) {
    return next(new AppError("This user is already a member of the organization.", conflict));
  }

  // A licence approval belongs to the person, so nobody becomes a carrier's
  // driver without accepting: otherwise a carrier could enrol another
  // carrier's approved driver and pass the compliance gate under their name.
  if (!user || role === "driver") {
    const { invitation, token, resent } = await createOrRefreshInvitation({
      organizationId,
      email,
      role,
      invitedByUserId: req.user.id,
    });

    await logActivity({
      req,
      action: ACTIVITY_ACTIONS.INVITE_ORG_MEMBER,
      entityType: "organization_invitations",
      entityId: invitation.id,
      description: `${resent ? "Resent the invitation to" : "Invited"} ${email} as ${role}`,
      metadata: { organizationId, role, resent },
    });
    notifyInvitation({
      email,
      token,
      organizationId,
      role,
      expiresAt: invitation.expiresAt,
      actorUserId: req.user.id,
      hasAccount: Boolean(user),
    });

    const withInviter = await organization_invitations.findByPk(invitation.id, { include: invitationInclude });
    return successResponse(res, created, { invitation: withInviter, resent });
  }

  const member = existing
    ? await existing.update({ role, active: true })
    : await organization_members.create({ userId: user.id, organizationId, role });
  // They signed up on their own after being invited: the open invitation is moot.
  await organization_invitations.update(
    { status: "revoked" },
    { where: { organizationId, email, status: "pending" } },
  );

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ADD_ORG_MEMBER,
    entityType: "organization_members",
    entityId: member.id,
    description: `Added ${user.email} as ${role}`,
    metadata: { organizationId, role },
  });
  notifyMemberAdded({ userId: user.id, organizationId, role, actorUserId: req.user.id });

  const withUser = await organization_members.findByPk(member.id, { include: memberInclude });
  return successResponse(res, created, { member: withUser });
});

/**
 * PATCH /api/v1/organizations/:id/members/:memberId: change a member's role.
 * Owner only; the last active owner cannot be demoted, only a transport
 * organization can have drivers, and nobody is switched to driver without
 * accepting an invitation.
 */
export const updateMemberRole = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);

  if (!hasOrgRole(req, organizationId, ["owner"])) {
    return next(new AppError("Only the organization owner can change member roles.", forbidden));
  }
  if (!isRoleSupported(req.body.role, companyTypeOf(req, organizationId))) {
    return next(new AppError(UNSUPPORTED_ROLE_MESSAGE, badRequest));
  }

  const member = await organization_members.findOne({
    where: { id: req.params.memberId, organizationId },
    include: memberInclude,
  });
  if (!member) {
    return next(new AppError("Member not found.", notFound));
  }
  // Becoming a driver needs the person's own acceptance (see addMember).
  if (req.body.role === "driver" && member.role !== "driver") {
    return next(
      new AppError(
        "A driver has to accept the role. Remove this member, then add them as a driver to send them an invitation.",
        badRequest,
      ),
    );
  }
  if (req.body.role !== "owner" && (await isLastActiveOwner(member))) {
    return next(
      new AppError("An organization needs at least one owner. Make someone else an owner first.", badRequest),
    );
  }

  const previousRole = member.role;
  await member.update({ role: req.body.role });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.UPDATE_ORG_MEMBER_ROLE,
    entityType: "organization_members",
    entityId: member.id,
    description: `Changed role of ${member.user?.email} from ${previousRole} to ${req.body.role}`,
    metadata: { organizationId, previousRole, newRole: req.body.role },
  });

  return successResponse(res, ok, { member });
});

/**
 * DELETE /api/v1/organizations/:id/members/:memberId: deactivate a membership.
 * Owner only; the last active owner cannot be removed.
 */
export const removeMember = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);

  if (!hasOrgRole(req, organizationId, ["owner"])) {
    return next(new AppError("Only the organization owner can remove members.", forbidden));
  }

  const member = await organization_members.findOne({
    where: { id: req.params.memberId, organizationId },
    include: memberInclude,
  });
  if (!member) {
    return next(new AppError("Member not found.", notFound));
  }

  if (member.userId === req.user.id) {
    return next(new AppError("The owner cannot remove themselves.", badRequest));
  }
  if (await isLastActiveOwner(member)) {
    return next(
      new AppError("An organization needs at least one owner. Make someone else an owner first.", badRequest),
    );
  }

  await member.update({ active: false });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.REMOVE_ORG_MEMBER,
    entityType: "organization_members",
    entityId: member.id,
    description: `Removed ${member.user?.email} from the organization`,
    metadata: { organizationId },
  });

  return deleteResponse(res, "Member removed from the organization.");
});

/**
 * GET /api/v1/organizations/:id/invitations: open invitations (pending or
 * expired), newest first. Owner/coordinator only.
 */
export const listInvitations = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);
  if (!hasOrgRole(req, organizationId, ["owner", "coordinator"])) {
    return next(new AppError("Only owners and coordinators can see invitations.", forbidden));
  }

  const invitations = await organization_invitations.findAll({
    where: { organizationId, status: "pending" },
    include: invitationInclude,
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { invitations });
});

/**
 * DELETE /api/v1/organizations/:id/invitations/:invitationId: revoke an open
 * invitation so its link stops working. Owner/coordinator only.
 */
export const revokeInvitation = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);
  if (!hasOrgRole(req, organizationId, ["owner", "coordinator"])) {
    return next(new AppError("Only owners and coordinators can revoke invitations.", forbidden));
  }

  const invitation = await organization_invitations.findOne({
    where: { id: req.params.invitationId, organizationId },
  });
  if (!invitation) return next(new AppError("Invitation not found.", notFound));
  if (invitation.status !== "pending") {
    return next(new AppError(`This invitation was already ${invitation.status}.`, badRequest));
  }

  await invitation.update({ status: "revoked" });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.REVOKE_ORG_INVITATION,
    entityType: "organization_invitations",
    entityId: invitation.id,
    description: `Revoked the invitation to ${invitation.email}`,
    metadata: { organizationId },
  });

  return deleteResponse(res, "Invitation revoked.");
});
