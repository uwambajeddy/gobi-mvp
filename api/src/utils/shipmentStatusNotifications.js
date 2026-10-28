import { createNotification, NOTIFICATION_ENTITY_TYPES } from "./notification";
import { appUrl } from "./emailTemplate";
import { STAFF_ROLES } from "../services/shipmentAccess.service";
import db from "../database/models";

const { users, organizations, organization_members } = db;

const staffUserIds = async (organizationId) => {
  if (!organizationId) return [];
  const members = await organization_members.findAll({
    where: { organizationId, role: STAFF_ROLES, active: true },
    attributes: ["userId"],
  });
  return members.map((m) => m.userId);
};

export const notifyShipmentStatusChange = async (
  status,
  shipment,
  { actorUserId = null, recipientName = null } = {},
) => {
  try {
    const driver = shipment.assignedDriverId
      ? await users.findByPk(shipment.assignedDriverId, { attributes: ["id", "firstName", "lastName"] })
      : null;
    const shipper = await organizations.findByPk(shipment.distributionOrgId, { attributes: ["name"] });

    const statusConfig = getStatusConfig(status, shipment, {
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : "The driver",
      shipperName: shipper?.name || "The shipper",
      recipientName,
    });

    const actionUrl = appUrl(`/dashboard/shipments/${shipment.id}`);
    const entity = { type: NOTIFICATION_ENTITY_TYPES.SHIPMENT, id: shipment.id };
    const notified = new Set([actorUserId]);
    const notify = async (userIds, title, message) => {
      for (const userId of userIds) {
        if (!message || notified.has(userId)) continue;
        notified.add(userId);
        await createNotification(title, message, userId, actionUrl, entity);
      }
    };

    if (driver) {
      await notify([driver.id], statusConfig.driverTitle, statusConfig.driverMessage);
    }

    await notify(await staffUserIds(shipment.distributionOrgId), statusConfig.title, statusConfig.clientMessage);

    const companyUserIds = [
      ...(await staffUserIds(shipment.transportOrgId)),
      ...(await staffUserIds(shipment.clearingAgentOrgId)),
    ];
    await notify(companyUserIds, statusConfig.title, statusConfig.companyMessage);
  } catch (error) {
    console.error("Error sending shipment status notification:", error.message);
  }
};

function getStatusConfig(status, shipment, { driverName, shipperName, recipientName }) {
  const ref = shipment.reference;
  const pickupLocation = shipment.originAddress || "the pickup location";
  const dropoffLocation = shipment.destinationAddress || "the destination";

  const config = {
    execution_assigned: {
      title: "Vehicle and driver assigned",
      clientMessage: `${driverName} will carry ${ref}. You'll be notified as the driver reports progress.`,
      companyMessage: `${driverName} was assigned to ${ref}.`,
      driverTitle: "New assignment",
      driverMessage: `You've been assigned ${ref}: ${pickupLocation} to ${dropoffLocation}. Tap "Going to pickup" when you set off.`,
    },

    en_route_to_pickup: {
      title: "Driver en route to pickup",
      clientMessage: `${driverName} is on the way to collect ${ref} from ${pickupLocation}. You can follow the truck live on the map.`,
      companyMessage: `${driverName} started ${ref} and is heading to ${pickupLocation}.`,
      driverTitle: "En route to pickup",
      driverMessage: `You're marked as on your way to ${pickupLocation} for ${ref}.`,
    },

    arrived_pickup: {
      title: "Driver at pickup",
      clientMessage: `${driverName} has arrived at ${pickupLocation} to collect ${ref}.`,
      companyMessage: `${driverName} has arrived at ${pickupLocation} for ${ref}.`,
      driverTitle: "Arrived at pickup",
      driverMessage: `You're marked as arrived at ${pickupLocation} for ${ref}.`,
    },

    picked_up: {
      title: "Cargo picked up",
      clientMessage: `${ref} was picked up from ${pickupLocation} and is on its way to ${dropoffLocation}.`,
      companyMessage: `${driverName} picked up ${ref} and is heading to ${dropoffLocation}.`,
      driverTitle: "Cargo picked up",
      driverMessage: `${ref} is marked as picked up. You're now heading to ${dropoffLocation}.`,
    },

    arrived_destination: {
      title: "Arrived at destination",
      clientMessage: `${ref} has arrived at ${dropoffLocation}. Proof of delivery is next.`,
      companyMessage: `${driverName} has arrived at ${dropoffLocation} with ${ref}.`,
      driverTitle: "Arrived at destination",
      driverMessage: `${ref} is marked as arrived at ${dropoffLocation}. Confirm the delivery once the cargo is handed over.`,
    },

    delivered: {
      title: "Shipment delivered",
      clientMessage: `${ref} was delivered at ${dropoffLocation}${
        recipientName ? `, received by ${recipientName}` : ""
      }. Please confirm receipt to complete the shipment.`,
      companyMessage: `${ref} was delivered at ${dropoffLocation}. Waiting for the shipper to confirm receipt.`,
      driverTitle: "Delivery recorded",
      driverMessage: `Delivery of ${ref} at ${dropoffLocation} is recorded. Waiting for the shipper to confirm receipt.`,
    },

    completed: {
      title: "Shipment completed",
      clientMessage: `${ref} is completed and closed.`,
      companyMessage: `${shipperName} confirmed receipt and completed ${ref}.`,
      driverTitle: "Shipment completed",
      driverMessage: `${shipperName} confirmed receipt of ${ref}. Thank you for using Gobi!`,
    },
  };

  return (
    config[status] || {
      title: "Shipment status update",
      clientMessage: `${ref} status has been updated to: ${status}`,
      companyMessage: `${ref} status has been updated to: ${status}`,
      driverTitle: "Shipment status update",
      driverMessage: `${ref} status has been updated to: ${status}`,
    }
  );
}

export default notifyShipmentStatusChange;
