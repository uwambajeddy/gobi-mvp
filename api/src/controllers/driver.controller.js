import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import db from "../database/models";

const { ok, created, conflict } = statusCodes;
const { driver_profiles } = db;

/**
 * POST /api/v1/driver/profile: submit (or resubmit) licence details for
 * platform verification. Approval is a platform-admin action.
 */
export const submitDriverProfile = catchAsync(async (req, res, next) => {
  const { licenceNumber, licenceExpiresAt } = req.body;

  const existing = await driver_profiles.findOne({ where: { userId: req.user.id } });

  if (existing) {
    if (existing.status === "approved") {
      return next(new AppError("Your driver profile is already approved.", conflict));
    }
    await existing.update({ licenceNumber, licenceExpiresAt, status: "pending" });

    await logActivity({
      req,
      action: ACTIVITY_ACTIONS.SUBMIT_DRIVER_PROFILE,
      entityType: "driver_profiles",
      entityId: existing.id,
      description: "Resubmitted driver profile for review",
    });

    return successResponse(res, ok, { driverProfile: existing });
  }

  const driverProfile = await driver_profiles.create({
    userId: req.user.id,
    licenceNumber,
    licenceExpiresAt,
  });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.SUBMIT_DRIVER_PROFILE,
    entityType: "driver_profiles",
    entityId: driverProfile.id,
    description: "Submitted driver profile for review",
  });

  return successResponse(res, created, { driverProfile });
});

/**
 * GET /api/v1/driver/profile
 */
export const getMyDriverProfile = catchAsync(async (req, res) => {
  const driverProfile = await driver_profiles.findOne({
    where: { userId: req.user.id },
  });

  return successResponse(res, ok, { driverProfile });
});
