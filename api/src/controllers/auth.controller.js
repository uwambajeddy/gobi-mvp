import bcrypt from "bcryptjs";
import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { generateTokens, generateAccessToken, verifyJwt } from "../utils/jwt.utils";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import db from "../database/models";

const { ok, created, badRequest, unAuthorized, conflict } = statusCodes;
const { users, organization_members, organizations } = db;

const membershipInclude = [
  {
    model: organization_members,
    as: "memberships",
    where: { active: true },
    required: false,
    include: [
      { model: organizations, as: "organization", attributes: ["id", "name", "companyType"] },
    ],
  },
];

/**
 * POST /api/v1/auth/register
 * Creates a platform user. Organization membership (and therefore any
 * operational role) is granted separately by an organization owner.
 */
export const register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;

  const existingUser = await users.findOne({ where: { email } });
  if (existingUser) {
    return next(new AppError("An account with this email already exists.", conflict));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await users.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    password: hashedPassword,
  });

  const tokens = generateTokens(user.id, user.type);

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.REGISTER_USER,
    entityType: "users",
    entityId: user.id,
    description: `${user.firstName} ${user.lastName} registered`,
  });

  return successResponse(res, created, { user, tokens });
});

/**
 * POST /api/v1/auth/login
 */
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await users.findOne({
    where: { email },
    include: membershipInclude,
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError("Incorrect email or password.", unAuthorized));
  }

  if (!user.isActive) {
    return next(new AppError("This account has been deactivated.", unAuthorized));
  }

  const tokens = generateTokens(user.id, user.type);

  return successResponse(res, ok, { user, tokens });
});

/**
 * POST /api/v1/auth/refreshToken
 * Exchanges a valid refresh token for a new access token.
 */
export const refreshToken = catchAsync(async (req, res, next) => {
  const token =
    req.body.refreshToken ||
    req.cookies?.refreshToken ||
    req.headers["x-refresh"];

  if (!token) {
    return next(new AppError("Refresh token is missing.", badRequest));
  }

  const { decoded, expired } = await verifyJwt(token, "refresh");

  if (!decoded) {
    return next(
      new AppError(
        expired ? "Your session has expired. Please log in again." : "Invalid refresh token.",
        unAuthorized,
      ),
    );
  }

  const user = await users.findOne({ where: { id: decoded.sub, isActive: true } });
  if (!user) {
    return next(new AppError("The user belonging to this token no longer exists.", unAuthorized));
  }

  const accessToken = generateAccessToken(user.id, user.type);

  return successResponse(res, ok, { accessToken });
});
