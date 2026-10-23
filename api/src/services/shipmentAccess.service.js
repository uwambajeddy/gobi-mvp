import { Op } from "sequelize";
import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import { SHIPMENT_POLICIES } from "../config/shipmentPolicies";
import db from "../database/models";

const { forbidden, badRequest } = statusCodes;
const { shipments, organizations, users, vehicles, shipment_packages } = db;

export const COORDINATOR_ROLES = ["owner", "coordinator"];

/**
 * Roles that act for their organization. A `driver` never does: drivers
 * reach a shipment only through their own assignment.
 */
export const STAFF_ROLES = ["owner", "coordinator", "member"];

const userSummary = ["id", "firstName", "lastName", "phoneNumber", "email"];
const orgSummary = ["id", "name", "companyType", "contactEmail", "contactPhone"];

export const shipmentIncludes = [
  { model: organizations, as: "distributionOrg", attributes: orgSummary },
  { model: organizations, as: "transportOrg", attributes: orgSummary },
  { model: organizations, as: "clearingAgentOrg", attributes: orgSummary },
  { model: users, as: "createdBy", attributes: userSummary },
  { model: users, as: "assignedDriver", attributes: userSummary },
  { model: vehicles, as: "assignedVehicle" },
  { model: shipment_packages, as: "packages" },
];

/** True when the user holds one of `roles` in the given organization. */
export const hasOrgRole = (req, organizationId, roles) =>
  (req.user.memberships || []).some(
    (m) => m.organizationId === organizationId && roles.includes(m.role),
  );

/** The user's active role in an organization, or null. */
const roleIn = (req, organizationId) =>
  organizationId
    ? (req.user.memberships || []).find((m) => m.organizationId === organizationId)?.role ?? null
    : null;

/**
 * The caller's relationship to a shipment. Party context drives every
 * authorization decision on shipment resources (see config/shipmentPolicies).
 */
export const getShipmentAccess = (shipment, req) => {
  const shipperRole = roleIn(req, shipment.distributionOrgId);
  const carrierRole = roleIn(req, shipment.transportOrgId);
  const agentRole = roleIn(req, shipment.clearingAgentOrgId);

  const access = {
    isAdmin: req.user.type === "admin",
    isShipper: STAFF_ROLES.includes(shipperRole),
    isCarrier: STAFF_ROLES.includes(carrierRole),
    isAgent: STAFF_ROLES.includes(agentRole),
    // Assigned, and still an active driver of the carrier.
    isAssignedDriver: shipment.assignedDriverId === req.user.id && carrierRole === "driver",
    isShipperCoordinator: COORDINATOR_ROLES.includes(shipperRole),
    isCarrierCoordinator: COORDINATOR_ROLES.includes(carrierRole),
    isAgentCoordinator: COORDINATOR_ROLES.includes(agentRole),
  };

  access.isParty =
    access.isAdmin || access.isShipper || access.isCarrier || access.isAgent || access.isAssignedDriver;

  return access;
};

/**
 * The 403/400 error for `action` on this shipment, or null when allowed.
 */
export const checkShipmentPolicy = (action, shipment, access) => {
  const policy = SHIPMENT_POLICIES[action];
  if (!policy) throw new Error(`Unknown shipment action: ${action}`);

  if (!policy.actors.some((flag) => access[flag])) {
    return new AppError(policy.denied, forbidden);
  }
  if (policy.stages && !policy.stages.includes(shipment.status)) {
    const message =
      typeof policy.wrongStage === "function" ? policy.wrongStage(shipment.status) : policy.wrongStage;
    return new AppError(message, badRequest);
  }
  return null;
};

/** Every action's verdict for this caller, for the web app to mirror. */
export const describeAllowedActions = (shipment, access) =>
  Object.fromEntries(
    Object.keys(SHIPMENT_POLICIES).map((action) => [
      action,
      !checkShipmentPolicy(action, shipment, access),
    ]),
  );

/**
 * WHERE clause for the shipments a user may list: those where one of their
 * organizations is a party through a non-driver role, plus those assigned
 * to them by a carrier they still drive for. Admins see everything.
 */
export const shipmentScope = (req) => {
  if (req.user.type === "admin") return {};

  const memberships = req.user.memberships || [];
  const staffOrgIds = memberships
    .filter((m) => STAFF_ROLES.includes(m.role))
    .map((m) => m.organizationId);
  const driverOrgIds = memberships.filter((m) => m.role === "driver").map((m) => m.organizationId);

  const conditions = [];
  if (staffOrgIds.length) {
    conditions.push(
      { distributionOrgId: { [Op.in]: staffOrgIds } },
      { transportOrgId: { [Op.in]: staffOrgIds } },
      { clearingAgentOrgId: { [Op.in]: staffOrgIds } },
    );
  }
  if (driverOrgIds.length) {
    conditions.push({ assignedDriverId: req.user.id, transportOrgId: { [Op.in]: driverOrgIds } });
  }

  return conditions.length ? { [Op.or]: conditions } : { id: null };
};

/** Human-friendly unique shipment reference, e.g. GB-2026-0042. */
export const generateShipmentReference = async () => {
  const year = new Date().getFullYear();
  const count = await shipments.count();
  const base = `GB-${year}-${String(count + 1).padStart(4, "0")}`;

  const clash = await shipments.findOne({ where: { reference: base } });
  if (!clash) return base;
  return `${base}-${Math.floor(Math.random() * 900 + 100)}`;
};
