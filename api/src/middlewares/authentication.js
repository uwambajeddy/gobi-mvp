import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { verifyJwt } from "../utils/jwt.utils";
import db from "../database/models";

const { unAuthorized, forbidden } = statusCodes;
const { users, organization_members, organizations } = db;

const membershipIncludes = [
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
];

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
    include: membershipIncludes,
  });

  if (!currentUser) {
    return next(new AppError("The user belonging to this token no longer exists.", unAuthorized));
  }

  req.user = currentUser;
  applyActiveOrganization(req);
  next();
});

export const protectSocket = async (socket, next) => {
  try {
    const accessToken = socket.handshake.auth?.token || socket.handshake.query?.token;

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
      include: membershipIncludes,
    });

    if (!currentUser) {
      return next(new AppError("The user belonging to this token no longer exists.", unAuthorized));
    }

    socket.userInfo = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

export const restrictToType = (...types) => {
  return (req, res, next) => {
    if (!req.user || !types.includes(req.user.type)) {
      return next(new AppError("You do not have permission to perform this action.", forbidden));
    }
    next();
  };
};
