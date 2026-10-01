import db from "../database/models";

const { activity_logs } = db;

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
    console.error("Failed to write activity log:", error.message);
  }
};
