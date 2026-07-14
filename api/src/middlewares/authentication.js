import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { verifyJwt } from "../utils/jwt.utils";
import db from "../database/models";

const { unAuthorized, forbidden } = statusCodes;
const { users, organization_members, organizations } = db;

/**
 * Resolves the caller's active organization membership.
 *
 * Multi-org users select their acting organization with the
 * `x-organization-id` header (set by the web app's org switcher);
 * single-org users fall back to their only membership.
 */
const applyActiveOrganization = (req) => {
  const memberships = req.user.memberships || [];
  const headerVal = req.headers["x-organization-id"];

  let membership = null;
  if (headerVal) {
    membership =
      memberships.find(
        (m) => Number(m.organizationId) === Number(headerVal),
      ) || null;
  } else if (memberships.length === 1) {
    membership = memberships[0];
  }

  req.activeMembership = membership;
};

/**
 * Authentication guard.
 * Verifies the access token, loads the user with their org memberships
 * and resolves the active organization context.
 */
export const protect = catchAsync(async (req, res, next) => {
  const accessToken =
    req.cookies?.accessToken ||
    (req.headers.authorization || "").replace(/^Bearer\s/, "");

  if (!accessToken) {
    return next(new AppError("You are not logged in. Please log in to get access.", unAuthorized));
  }

  const { decoded, expired } = await verifyJwt(accessToken, "access");

  if (!decoded) {
    return next(
      new AppError(
        expired ? "Your session has expired. Please log in again." : "Invalid access token.",
        unAuthorized,
      ),
    );
  }

  const currentUser = await users.findOne({
    where: { id: decoded.sub, isActive: true },
    include: [
      {
        model: organization_members,
        as: "memberships",
        where: { active: true },
        required: false,
        include: [
          {
            model: organizations,
            as: "organization",
            attributes: ["id", "name", "companyType"],
          },
        ],
      },
    ],
  });

  if (!currentUser) {
    return next(new AppError("The user belonging to this token no longer exists.", unAuthorized));
  }

  req.user = currentUser;
  applyActiveOrganization(req);
  next();
});

/**
 * Platform-level type guard (e.g. restrictToType("admin")). Use after `protect`.
 */
export const restrictToType = (...types) => {
  return (req, res, next) => {
    if (!req.user || !types.includes(req.user.type)) {
      return next(new AppError("You do not have permission to perform this action.", forbidden));
    }
    next();
  };
};
