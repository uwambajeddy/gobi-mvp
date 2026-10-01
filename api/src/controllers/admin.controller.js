import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import db from "../database/models";

const { ok, notFound } = statusCodes;
const {
  users,
  organizations,
  driver_profiles,
  shipments,
  shipment_exceptions,
  activity_logs,
} = db;

const userSummary = ["id", "firstName", "lastName", "email", "phoneNumber"];

/**
 * GET /api/v1/admin/drivers: driver profiles by review status.
 */
export const getDriverProfiles = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;

  const profiles = await driver_profiles.findAll({
    where,
    include: [{ model: users, as: "user", attributes: userSummary }],
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { driverProfiles: profiles });
});

/**
 * PATCH /api/v1/admin/drivers/:id: approve or reject a driver profile.
 */
export const reviewDriverProfile = catchAsync(async (req, res, next) => {
  const profile = await driver_profiles.findByPk(req.params.id, {
    include: [{ model: users, as: "user", attributes: userSummary }],
  });

  if (!profile) {
    return next(new AppError("Driver profile not found.", notFound));
  }

  await profile.update({ status: req.body.status });

  await logActivity({
    req,
    action:
      req.body.status === "approved"
        ? ACTIVITY_ACTIONS.VERIFY_DRIVER
        : ACTIVITY_ACTIONS.REJECT_DRIVER,
    entityType: "driver_profiles",
    entityId: profile.id,
    description: `${req.body.status === "approved" ? "Approved" : "Rejected"} driver ${profile.user?.email}`,
    metadata: { status: req.body.status },
  });

  return successResponse(res, ok, { driverProfile: profile });
});

/**
 * GET /api/v1/admin/organizations: all organizations with member counts.
 */
export const listOrganizations = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.companyType) where.companyType = req.query.companyType;

  const allOrganizations = await organizations.findAll({
    where,
    order: [["createdAt", "DESC"]],
  });

  return successResponse(res, ok, { organizations: allOrganizations });
});

/**
 * GET /api/v1/admin/activity-logs: the platform audit trail.
 * Filterable by entity, action and actor; newest first.
 */
export const getActivityLogs = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.entityId) where.entityId = req.query.entityId;
  if (req.query.action) where.action = req.query.action;
  if (req.query.actorId) where.actorId = req.query.actorId;

  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const logs = await activity_logs.findAll({
    where,
    include: [
      { model: users, as: "actor", attributes: ["id", "firstName", "lastName", "email"] },
      { model: organizations, as: "organization", attributes: ["id", "name", "companyType"] },
    ],
    order: [["createdAt", "DESC"]],
    limit,
  });

  return successResponse(res, ok, { logs });
});

/**
 * GET /api/v1/admin/stats: platform counters for the admin dashboard.
 */
export const getStats = catchAsync(async (req, res) => {
  const [
    totalUsers,
    totalOrganizations,
    distributionOrgs,
    transportOrgs,
    clearingAgentOrgs,
    pendingDrivers,
    totalShipments,
    activeShipments,
    completedShipments,
    openExceptions,
  ] = await Promise.all([
    users.count(),
    organizations.count(),
    organizations.count({ where: { companyType: "distribution" } }),
    organizations.count({ where: { companyType: "transport" } }),
    organizations.count({ where: { companyType: "clearing_agent" } }),
    driver_profiles.count({ where: { status: "pending" } }),
    shipments.count(),
    shipments.count({
      where: {
        status: [
          "submitted",
          "quote_approved",
          "awaiting_documents",
          "documents_complete",
          "execution_assigned",
          "in_transit",
          "arrived",
          "delivered",
        ],
      },
    }),
    shipments.count({ where: { status: "completed" } }),
    shipment_exceptions.count({ where: { status: ["open", "investigating"] } }),
  ]);

  return successResponse(res, ok, {
    stats: {
      users: { total: totalUsers },
      organizations: {
        total: totalOrganizations,
        distribution: distributionOrgs,
        transport: transportOrgs,
        clearingAgents: clearingAgentOrgs,
      },
      driverApprovals: { pending: pendingDrivers },
      shipments: {
        total: totalShipments,
        active: activeShipments,
        completed: completedShipments,
      },
      exceptions: { open: openExceptions },
    },
  });
});
