/**
 * Shipment Status Notifications Utility
 * Sends consistent notifications to every party of a shipment when the driver
 * reports progress or the status changes (the commercial platform's
 * notifyDeliveryStatusChange, widened from client + driver + carrier to the
 * MVP's four parties). Uses entity-based navigation for in-app.
 */

import { createNotification, NOTIFICATION_ENTITY_TYPES } from "./notification";
import { appUrl } from "./emailTemplate";
import { STAFF_ROLES } from "../services/shipmentAccess.service";
import db from "../database/models";

const { users, organizations, organization_members } = db;

/** Active staff (owner, coordinator, member; not drivers) user IDs of an organization. */
const staffUserIds = async (organizationId) => {
  if (!organizationId) return [];
  const members = await organization_members.findAll({
    where: { organizationId, role: STAFF_ROLES, active: true },
    attributes: ["userId"],
  });
  return members.map((m) => m.userId);
};

/**
 * Notify every party about a shipment status change
 * @param {string} status - The milestone or new status (see getStatusConfig)
 * @param {object} shipment - The shipments instance, after the change
 * @param {object} options
 * @param {number|null} options.actorUserId - Who made the change; they are not notified
 * @param {string|null} options.recipientName - Who received the cargo (delivered)
 */
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

    // Define status-specific messages
    const statusConfig = getStatusConfig(status, shipment, {
      driverName: driver ? `${driver.firstName} ${driver.lastName}` : "The driver",
      shipperName: shipper?.name || "The shipper",
      recipientName,
    });

    const actionUrl = appUrl(`/dashboard/shipments/${shipment.id}`);
    const entity = { type: NOTIFICATION_ENTITY_TYPES.SHIPMENT, id: shipment.id };
    // One notification per person, never to whoever made the change.
    const notified = new Set([actorUserId]);
    const notify = async (userIds, title, message) => {
      for (const userId of userIds) {
        if (!message || notified.has(userId)) continue;
        notified.add(userId);
        await createNotification(title, message, userId, actionUrl, entity);
      }
    };

    // Notify Driver
    if (driver) {
      await notify([driver.id], statusConfig.driverTitle, statusConfig.driverMessage);
    }

    // Notify the shipper's staff (the commercial platform's client)
    await notify(await staffUserIds(shipment.distributionOrgId), statusConfig.title, statusConfig.clientMessage);

    // Notify the carrier's and clearing agent's staff
    const companyUserIds = [
      ...(await staffUserIds(shipment.transportOrgId)),
      ...(await staffUserIds(shipment.clearingAgentOrgId)),
    ];
    await notify(companyUserIds, statusConfig.title, statusConfig.companyMessage);
  } catch (error) {
    console.error("Error sending shipment status notification:", error.message);
  }
};

/**
 * Get status-specific configuration: one title for the shipment's parties,
 * a message for the shipper (client), one for the carrier and clearing agent
 * (company), and the driver's own title and message.
 */
function getStatusConfig(status, shipment, { driverName, shipperName, recipientName }) {
  const ref = shipment.reference;
  const pickupLocation = shipment.originAddress || "the pickup location";
  const dropoffLocation = shipment.destinationAddress || "the destination";

  const config = {
    // EXECUTION_ASSIGNED: Carrier assigned a vehicle and driver
    execution_assigned: {
      title: "Vehicle and driver assigned",
      clientMessage: `${driverName} will carry ${ref}. You'll be notified as the driver reports progress.`,
      companyMessage: `${driverName} was assigned to ${ref}.`,
      driverTitle: "New assignment",
      driverMessage: `You've been assigned ${ref}: ${pickupLocation} to ${dropoffLocation}. Tap "Going to pickup" when you set off.`,
    },

    // EN_ROUTE_TO_PICKUP: Driver set off; live tracking starts
    en_route_to_pickup: {
      title: "Driver en route to pickup",
      clientMessage: `${driverName} is on the way to collect ${ref} from ${pickupLocation}. You can follow the truck live on the map.`,
      companyMessage: `${driverName} started ${ref} and is heading to ${pickupLocation}.`,
      driverTitle: "En route to pickup",
      driverMessage: `You're marked as on your way to ${pickupLocation} for ${ref}.`,
    },

    // ARRIVED_PICKUP: Driver reached the pickup location
    arrived_pickup: {
      title: "Driver at pickup",
      clientMessage: `${driverName} has arrived at ${pickupLocation} to collect ${ref}.`,
      companyMessage: `${driverName} has arrived at ${pickupLocation} for ${ref}.`,
      driverTitle: "Arrived at pickup",
      driverMessage: `You're marked as arrived at ${pickupLocation} for ${ref}.`,
    },

    // PICKED_UP: Cargo loaded, shipment in transit
    picked_up: {
      title: "Cargo picked up",
      clientMessage: `${ref} was picked up from ${pickupLocation} and is on its way to ${dropoffLocation}.`,
      companyMessage: `${driverName} picked up ${ref} and is heading to ${dropoffLocation}.`,
      driverTitle: "Cargo picked up",
      driverMessage: `${ref} is marked as picked up. You're now heading to ${dropoffLocation}.`,
    },

    // ARRIVED_DESTINATION: Driver reached the delivery location
    arrived_destination: {
      title: "Arrived at destination",
      clientMessage: `${ref} has arrived at ${dropoffLocation}. Proof of delivery is next.`,
      companyMessage: `${driverName} has arrived at ${dropoffLocation} with ${ref}.`,
      driverTitle: "Arrived at destination",
      driverMessage: `${ref} is marked as arrived at ${dropoffLocation}. Confirm the delivery once the cargo is handed over.`,
    },

    // DELIVERED: Proof of delivery captured
    delivered: {
      title: "Shipment delivered",
      clientMessage: `${ref} was delivered at ${dropoffLocation}${
        recipientName ? `, received by ${recipientName}` : ""
      }. Please confirm receipt to complete the shipment.`,
      companyMessage: `${ref} was delivered at ${dropoffLocation}. Waiting for the shipper to confirm receipt.`,
      driverTitle: "Delivery recorded",
      driverMessage: `Delivery of ${ref} at ${dropoffLocation} is recorded. Waiting for the shipper to confirm receipt.`,
    },

    // COMPLETED: Shipper confirmed receipt
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
