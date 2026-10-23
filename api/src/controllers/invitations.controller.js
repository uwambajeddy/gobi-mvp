import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { findInvitationByToken } from "../services/invitations.service";
import { isActiveOwner, isRoleSupported, UNSUPPORTED_ROLE_MESSAGE } from "../services/organizationAccess.service";
import db from "../database/models";

const { ok, badRequest, notFound, forbidden, conflict } = statusCodes;
const { organization_members, users } = db;

const sameEmail = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * GET /api/v1/invitations/:token: public preview for the emailed link, so the
 * page can say who invited whom, and whether to sign in or create an account.
 */
export const getInvitation = catchAsync(async (req, res, next) => {
  const invitation = await findInvitationByToken(req.params.token);
  if (!invitation) {
    return next(new AppError("This invitation link isn't valid. It may have been replaced by a newer one.", notFound));
  }

  const hasAccount = Boolean(await users.count({ where: { email: invitation.email } }));
  return successResponse(res, ok, { invitation, hasAccount });
});

/**
 * POST /api/v1/invitations/:token/accept: join the organization. Needs the
 * emailed token (proof of access to the inbox) and a signed-in account with
 * the invited email address. An owner invitation only grants ownership while
 * the person who sent it is still an owner, and a driver invitation only
 * works for a transport organization (older invitations may predate both rules).
 */
export const acceptInvitation = catchAsync(async (req, res, next) => {
  const invitation = await findInvitationByToken(req.params.token);
  if (!invitation) {
    return next(new AppError("This invitation link isn't valid. It may have been replaced by a newer one.", notFound));
  }

  const orgName = invitation.organization?.name || "the organization";
  if (invitation.status === "accepted") {
    return next(new AppError(`This invitation to ${orgName} has already been accepted.`, conflict));
  }
  if (invitation.status === "revoked") {
    return next(new AppError(`This invitation to ${orgName} was withdrawn. Ask them to send a new one.`, badRequest));
  }
  if (invitation.isExpired) {
    return next(new AppError(`This invitation to ${orgName} has expired. Ask them to send a new one.`, badRequest));
  }
  if (!sameEmail(invitation.email, req.user.email)) {
    return next(
      new AppError(`This invitation was sent to ${invitation.email}. Sign in with that email to accept it.`, forbidden),
    );
  }

  const { organizationId, role } = invitation;
  if (!isRoleSupported(role, invitation.organization?.companyType)) {
    return next(new AppError(`${UNSUPPORTED_ROLE_MESSAGE} Ask ${orgName} to invite you with another role.`, badRequest));
  }
  if (role === "owner" && !(await isActiveOwner(invitation.invitedByUserId, organizationId))) {
    return next(
      new AppError(`This invitation can't make you an owner of ${orgName}. Ask an owner to invite you again.`, forbidden),
    );
  }

  const existing = await organization_members.findOne({ where: { userId: req.user.id, organizationId } });
  const membership = existing
    ? existing.active
      ? existing
      : await existing.update({ role, active: true })
    : await organization_members.create({ userId: req.user.id, organizationId, role });

  await invitation.update({ status: "accepted", acceptedByUserId: req.user.id, acceptedAt: new Date() });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.ACCEPT_ORG_INVITATION,
    entityType: "organization_members",
    entityId: membership.id,
    description: `${req.user.email} accepted the invitation to ${orgName} as ${membership.role}`,
    metadata: { organizationId, invitationId: invitation.id, role: membership.role },
  });

  return successResponse(res, ok, { membership, organization: invitation.organization });
});
