import bcrypt from "bcryptjs";
import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import db from "../database/models";

const { ok, unAuthorized } = statusCodes;
const { users, driver_profiles } = db;

/**
 * GET /api/v1/profile
 */
export const getProfile = catchAsync(async (req, res) => {
  const user = await users.findByPk(req.user.id, {
    include: [{ model: driver_profiles, as: "driverProfile" }],
  });

  return successResponse(res, ok, { user });
});

/**
 * PATCH /api/v1/profile
 */
export const updateProfile = catchAsync(async (req, res) => {
  const { firstName, lastName, phoneNumber } = req.body;

  await req.user.update({
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(phoneNumber !== undefined && { phoneNumber }),
  });

  return successResponse(res, ok, { user: req.user });
});

/**
 * PATCH /api/v1/profile/password
 */
export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const isMatch = await bcrypt.compare(currentPassword, req.user.password);
  if (!isMatch) {
    return next(new AppError("Current password is incorrect.", unAuthorized));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await req.user.update({ password: hashedPassword });

  return successResponse(res, ok, { message: "Password updated successfully." });
});
