import bcrypt from "bcryptjs";
import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import { generateTokens, generateAccessToken, verifyJwt } from "../utils/jwt.utils";
import { logActivity } from "../services/activityLog.service";
import { ACTIVITY_ACTIONS } from "../utils/activityActions";
import { notifyVerificationCode, notifyWelcome } from "../services/notifications.service";
import { findInvitationByToken } from "../services/invitations.service";
import {
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  codeMatches,
  describeSignup,
  refreshSignupCode,
  startPendingSignup,
} from "../services/signupVerification.service";
import db from "../database/models";

const { ok, created, badRequest, unAuthorized, notFound, conflict, tooManyRequests } = statusCodes;
const { users, organization_members, organizations, pending_signups } = db;

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

/** Creates the account once the email is proven, logs it and sends the welcome email. */
const createVerifiedUser = async (req, { firstName, lastName, email, phoneNumber, passwordHash }, how) => {
  const user = await users.create({ firstName, lastName, email, phoneNumber, password: passwordHash });

  await logActivity({
    req,
    action: ACTIVITY_ACTIONS.REGISTER_USER,
    entityType: "users",
    entityId: user.id,
    description: `${user.firstName} ${user.lastName} registered`,
    metadata: { emailVerifiedBy: how },
  });
  if (how === "code") notifyWelcome(user);

  return user;
};

/**
 * POST /api/v1/auth/register
 * Starts a sign-up. No account exists until the email is proven: the response
 * is a `verification` handle and a 6-digit code goes to the address, to be
 * entered via POST /auth/verify-email. With an `inviteToken` for the same
 * email, the invitation already proves the inbox, so the account (`user`) is
 * created at once. Organization roles are granted separately.
 */
export const register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, phoneNumber, password, inviteToken } = req.body;

  if (await users.count({ where: { email } })) {
    return next(new AppError("An account with this email already exists.", conflict));
  }

  const details = { firstName, lastName, email, phoneNumber, passwordHash: await bcrypt.hash(password, 10) };

  if (inviteToken) {
    const invitation = await findInvitationByToken(inviteToken);
    if (invitation && invitation.status === "pending" && !invitation.isExpired && invitation.email === email) {
      const user = await createVerifiedUser(req, details, "invitation");
      return successResponse(res, created, { user });
    }
  }

  const { signup, code } = await startPendingSignup(details);
  notifyVerificationCode({ email, firstName, code, expiresInMinutes: CODE_TTL_MINUTES });

  return successResponse(res, created, { verification: describeSignup(signup) });
});

const signupGone = () =>
  new AppError("This sign-up has expired or was already completed. Start again to get a new code.", notFound);

/**
 * POST /api/v1/auth/verify-email
 * Checks the emailed code for a pending sign-up and creates the account.
 * Five wrong codes lock that code; a resend issues a new one.
 */
export const verifyEmail = catchAsync(async (req, res, next) => {
  const { verificationId, code } = req.body;

  const signup = await pending_signups.findOne({ where: { handle: verificationId } });
  if (!signup || new Date(signup.expiresAt) < new Date()) {
    if (signup) await signup.destroy();
    return next(signupGone());
  }
  if (signup.attempts >= MAX_CODE_ATTEMPTS) {
    return next(new AppError("Too many wrong codes. Send a new code and try again.", tooManyRequests));
  }

  if (!(await codeMatches(signup, code))) {
    const left = MAX_CODE_ATTEMPTS - (signup.attempts + 1);
    await signup.increment("attempts");
    return next(
      new AppError(
        left > 0
          ? `That code isn't right. You have ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That code isn't right. Send a new code and try again.",
        badRequest,
      ),
    );
  }

  // Another sign-up for this email may have finished first.
  if (await users.count({ where: { email: signup.email } })) {
    await signup.destroy();
    return next(new AppError("An account with this email already exists. Sign in instead.", conflict));
  }

  const user = await createVerifiedUser(req, signup.get(), "code");
  await pending_signups.destroy({ where: { email: signup.email } });

  const tokens = generateTokens(user.id, user.type);
  return successResponse(res, created, { user, tokens });
});

/**
 * POST /api/v1/auth/resend-verification
 * Sends a new code for a pending sign-up, at most once every 30 seconds.
 */
export const resendVerification = catchAsync(async (req, res, next) => {
  const signup = await pending_signups.findOne({ where: { handle: req.body.verificationId } });
  if (!signup || new Date(signup.expiresAt) < new Date()) {
    if (signup) await signup.destroy();
    return next(signupGone());
  }

  const waitMs = new Date(describeSignup(signup).resendAvailableAt).getTime() - Date.now();
  if (waitMs > 0) {
    return next(
      new AppError(`Wait ${Math.ceil(waitMs / 1000)} seconds before asking for another code.`, tooManyRequests),
    );
  }

  const code = await refreshSignupCode(signup);
  notifyVerificationCode({ email: signup.email, firstName: signup.firstName, code, expiresInMinutes: CODE_TTL_MINUTES });

  return successResponse(res, ok, { verification: describeSignup(signup) });
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
