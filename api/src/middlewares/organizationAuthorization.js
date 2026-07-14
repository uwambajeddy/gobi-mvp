import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";

const { forbidden, badRequest } = statusCodes;

/**
 * Requires an active organization context (resolved by `protect`).
 * Multi-org users must send the `x-organization-id` header.
 */
export const requireMembership = (req, res, next) => {
  if (!req.activeMembership) {
    return next(
      new AppError(
        "This action requires an organization context. Join an organization or set the x-organization-id header.",
        badRequest,
      ),
    );
  }
  next();
};

/**
 * Restricts to specific roles inside the active organization.
 * e.g. requireOrgRole("owner", "coordinator")
 */
export const requireOrgRole = (...roles) => {
  return (req, res, next) => {
    if (!req.activeMembership || !roles.includes(req.activeMembership.role)) {
      return next(
        new AppError("Your role in this organization does not permit this action.", forbidden),
      );
    }
    next();
  };
};

/**
 * Restricts to organizations of a given company type.
 * e.g. requireCompanyType("transport")
 */
export const requireCompanyType = (...types) => {
  return (req, res, next) => {
    const companyType = req.activeMembership?.organization?.companyType;
    if (!companyType || !types.includes(companyType)) {
      return next(
        new AppError(
          `This action is only available to ${types.join(" or ")} organizations.`,
          forbidden,
        ),
      );
    }
    next();
  };
};
