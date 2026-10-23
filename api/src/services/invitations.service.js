import crypto from "crypto";
import db from "../database/models";

const { organization_invitations, organizations, users } = db;

export const INVITATION_TTL_DAYS = 7;

export const hashInvitationToken = (token = "") => crypto.createHash("sha256").update(String(token)).digest("hex");

export const invitationInclude = [
  { model: organizations, as: "organization", attributes: ["id", "name", "companyType"] },
  { model: users, as: "invitedBy", attributes: ["id", "firstName", "lastName"] },
];

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

export const findInvitationByToken = (token) =>
  organization_invitations.findOne({
    where: { tokenHash: hashInvitationToken(token) },
    include: invitationInclude,
  });
