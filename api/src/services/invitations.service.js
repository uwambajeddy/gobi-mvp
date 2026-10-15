import crypto from "crypto";
import db from "../database/models";

const { organization_invitations, organizations, users } = db;

export const INVITATION_TTL_DAYS = 7;

/** The emailed token is random; only its hash is stored. */
export const hashInvitationToken = (token = "") => crypto.createHash("sha256").update(String(token)).digest("hex");

export const invitationInclude = [
  { model: organizations, as: "organization", attributes: ["id", "name", "companyType"] },
  { model: users, as: "invitedBy", attributes: ["id", "firstName", "lastName"] },
];

/**
 * Creates a pending invitation, or refreshes the open one for the same email
 * (new role, new token, new expiry), which is how "resend" works. Returns the
 * invitation and the raw token, which only ever goes into the email.
 */
export const createOrRefreshInvitation = async ({ organizationId, email, role, invitedByUserId }) => {
  const token = crypto.randomBytes(32).toString("hex");
  const fields = {
    role,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
    invitedByUserId,
  };

  const open = await organization_invitations.findOne({ where: { organizationId, email, status: "pending" } });
  const invitation = open
    ? await open.update(fields)
    : await organization_invitations.create({ organizationId, email, ...fields });

  return { invitation, token, resent: Boolean(open) };
};

/** Looks up an invitation from the token in an emailed link. */
export const findInvitationByToken = (token) =>
  organization_invitations.findOne({
    where: { tokenHash: hashInvitationToken(token) },
    include: invitationInclude,
  });
