import db from "../database/models";

const { activity_logs } = db;

/**
 * Writes one immutable audit row. Called by every mutating endpoint.
 *
 * Captures who (actor + role + org), what (action + entity), and the
 * structured evidence (metadata), e.g. gate override justifications.
 */
export const logActivity = async ({
  req,
  action,
  entityType,
  entityId,
  description,
  metadata,
}) => {
  try {
    await activity_logs.create({
      actorId: req?.user?.id ?? null,
      actorRole:
        req?.activeMembership?.role ??
        (req?.user?.type === "admin" ? "platform_admin" : null),
      organizationId: req?.activeMembership?.organizationId ?? null,
      action,
      entityType,
      entityId,
      description,
      metadata,
      ipAddress: req?.ip,
    });
  } catch (error) {
    // Audit failures must never break the business action itself.
    console.error("Failed to write activity log:", error.message);
  }
};
