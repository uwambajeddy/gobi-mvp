import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse, deleteResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { hasOrgRole } from "../services/shipmentAccess.service";
import db from "../database/models";

const { ok, created, badRequest, notFound, forbidden, conflict } = statusCodes;
const { organizations, organization_members, users } = db;

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
 * POST /api/v1/organizations/:id/members: add an existing user by email.
 * Owner/coordinator only.
 */
export const addMember = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);
  const { email, role } = req.body;

  if (!hasOrgRole(req, organizationId, ["owner", "coordinator"])) {
    return next(new AppError("Only owners and coordinators can add members.", forbidden));
  }

  const user = await users.findOne({ where: { email } });
  if (!user) {
    return next(new AppError(`No account found for ${email}. Ask them to register first.`, notFound));
  }

  const existing = await organization_members.findOne({
    where: { userId: user.id, organizationId },
  });
  if (existing && existing.active) {
    return next(new AppError("This user is already a member of the organization.", conflict));
  }

  const member = existing
    ? await existing.update({ role, active: true })
    : await organization_members.create({ userId: user.id, organizationId, role });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ADD_ORG_MEMBER,
    entityType: "organization_members",
    entityId: member.id,
    description: `Added ${user.email} as ${role}`,
    metadata: { organizationId, role },
  });

  const withUser = await organization_members.findByPk(member.id, { include: memberInclude });
  return successResponse(res, created, { member: withUser });
});

/**
 * PATCH /api/v1/organizations/:id/members/:memberId: change a member's role.
 * Owner only.
 */
export const updateMemberRole = catchAsync(async (req, res, next) => {
  const organizationId = Number(req.params.id);

  if (!hasOrgRole(req, organizationId, ["owner"])) {
    return next(new AppError("Only the organization owner can change member roles.", forbidden));
  }

  const member = await organization_members.findOne({
    where: { id: req.params.memberId, organizationId },
    include: memberInclude,
  });
  if (!member) {
    return next(new AppError("Member not found.", notFound));
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
 * Owner only.
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
