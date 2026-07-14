import db from "../database/models";

const { shipments, organizations, users, vehicles, shipment_packages } = db;

export const COORDINATOR_ROLES = ["owner", "coordinator"];

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

/**
 * Loads a shipment and computes the caller's relationship to it.
 * Party context drives every authorization decision on shipment resources.
 */
export const getShipmentWithContext = async (shipmentId, req, { include = shipmentIncludes } = {}) => {
  const shipment = await shipments.findByPk(shipmentId, { include });
  if (!shipment) return { shipment: null, ctx: null };

  const userOrgIds = (req.user.memberships || []).map((m) => m.organizationId);

  const ctx = {
    isAdmin: req.user.type === "admin",
    isShipper: userOrgIds.includes(shipment.distributionOrgId),
    isCarrier: Boolean(shipment.transportOrgId && userOrgIds.includes(shipment.transportOrgId)),
    isAgent: Boolean(
      shipment.clearingAgentOrgId && userOrgIds.includes(shipment.clearingAgentOrgId),
    ),
    isAssignedDriver: shipment.assignedDriverId === req.user.id,
    isShipperCoordinator: hasOrgRole(req, shipment.distributionOrgId, COORDINATOR_ROLES),
    isCarrierCoordinator: Boolean(
      shipment.transportOrgId && hasOrgRole(req, shipment.transportOrgId, COORDINATOR_ROLES),
    ),
    isAgentCoordinator: Boolean(
      shipment.clearingAgentOrgId &&
        hasOrgRole(req, shipment.clearingAgentOrgId, COORDINATOR_ROLES),
    ),
  };

  ctx.isParty =
    ctx.isAdmin || ctx.isShipper || ctx.isCarrier || ctx.isAgent || ctx.isAssignedDriver;

  return { shipment, ctx };
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
