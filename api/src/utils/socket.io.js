// Import necessary modules and models
import db from "../database/models";
import logger from "./logger";
import {
  STAFF_ROLES,
  checkShipmentPolicy,
  getShipmentAccess,
} from "../services/shipmentAccess.service";

const { shipments, organization_members } = db;

// Store io instance to avoid circular dependency
let ioInstance = null;

/**
 * Connected clients: user id -> socket id.
 * The commercial platform keeps this in a Redis hash ("connectedClients");
 * the MVP runs a single API process, so an in-memory Map does the same job.
 */
const connectedClients = new Map();

/**
 * Initialize the socket.io instance
 * @param {Server} io - The socket.io server instance
 */
export function initializeSocketIO(io) {
  ioInstance = io;
}

/**
 * Get the socket.io instance
 * @returns {Server} The socket.io server instance
 */
function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized. Call initializeSocketIO first.");
  }
  return ioInstance;
}

/**
 * Remember which socket a user is connected on (called on connection).
 * @param {string|number} userId - The user ID
 * @param {string} socketId - The socket ID
 */
export function addConnectedClient(userId, socketId) {
  connectedClients.set(`${userId}`, socketId);
}

/**
 * Get socket ID for a user
 * @param {string|number} userId - The user ID
 * @returns {string|null}
 */
function getSocketIdByUserId(userId) {
  return connectedClients.get(`${userId}`) || null;
}

/**
 * Emit to a specific user by their user ID.
 * Offline users are skipped: location updates are not queued for later
 * (the commercial platform's pending-events queue skips them too).
 * @param {string|number} userId - The user ID
 * @param {string} event - Event name
 * @param {object} data - Data to send
 * @returns {Promise<boolean>} true when the user was connected
 */
export async function emitToUser(userId, event, data) {
  const socketId = getSocketIdByUserId(userId);
  if (socketId) {
    getIO().to(socketId).emit(event, data);
    return true;
  }
  return false;
}

/**
 * Emit a socket event to everyone working on a shipment: active staff of the
 * shipper, carrier and clearing agent organizations, plus the assigned driver.
 * (The commercial platform's emitToOrgMembers, widened to the three parties.)
 * @param {object} shipment - shipments instance
 * @param {string} event - Event name
 * @param {object} data - Data to send
 */
export async function emitToShipmentParties(shipment, event, data) {
  const organizationIds = [
    shipment.distributionOrgId,
    shipment.transportOrgId,
    shipment.clearingAgentOrgId,
  ].filter(Boolean);

  const members = await organization_members.findAll({
    where: { organizationId: organizationIds, role: STAFF_ROLES, active: true },
    attributes: ["userId"],
  });

  const userIds = new Set(members.map((m) => m.userId));
  if (shipment.assignedDriverId) userIds.add(shipment.assignedDriverId);

  for (const userId of userIds) {
    await emitToUser(userId, event, data);
  }
}

// Listen for incoming connections from clients
export function shipmentLiveServices(client) {
  // Update shipment coordinates (sent by the assigned driver's browser)
  client.on("newCoordinates", async (shipmentId, coordinates, timeStamp) => {
    try {
      // Validate arguments
      if (typeof shipmentId !== "string" && typeof shipmentId !== "number") {
        throw new TypeError("Invalid shipmentId. Expected string or number.");
      }
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        coordinates.some((coord) => typeof coord !== "number" || isNaN(coord))
      ) {
        throw new TypeError("Invalid coordinates. Expected [number, number].");
      }
      if (typeof timeStamp !== "string") {
        throw new TypeError("Invalid timeStamp. Expected string.");
      }

      const shipmentIdInt = parseInt(shipmentId, 10);
      const shipment = isNaN(shipmentIdInt) ? null : await shipments.findByPk(shipmentIdInt);
      if (!shipment) {
        throw new Error(`Shipment ${shipmentId} not found.`);
      }

      // Only the assigned driver, while the shipment is in transit (config/shipmentPolicies)
      const access = getShipmentAccess(shipment, { user: client.userInfo });
      const denied = checkShipmentPolicy("updateLocation", shipment, access);
      if (denied) throw denied;

      const [lat, lng] = coordinates;
      const lastLocationUpdate = new Date();

      // Persist current location to DB. `silent`: a location ping is not an
      // edit, so the shipment's updatedAt is left alone.
      await shipment.update(
        { currentLocation: { lat, lng }, lastLocationUpdate },
        { silent: true },
      );

      // Emit updated coordinates to every party of the shipment.
      // `lastLocationUpdate` is the server's clock, which viewers use to order
      // updates (the driver's own `timeStamp` is passed through as sent).
      await emitToShipmentParties(shipment, "newCoordinates", {
        data: {
          shipmentId: shipment.id,
          coordinates,
          timeStamp,
          lastLocationUpdate: lastLocationUpdate.toISOString(),
        },
        status: true,
      });

      logger.info(`[LOCATION UPDATE] Shipment ${shipment.id}: coords: [${lat}, ${lng}]`);
    } catch (error) {
      logger.error("Error in newCoordinates handler:", error.message);
      client.emit("newCoordinates", {
        message: error.message || "Sorry, there was an error",
        status: false,
      });
    }
  });

  // Handle client disconnect event
  client.on("disconnect", () => {
    const userId = `${client.userInfo.id}`;
    logger.error(`Client disconnected: ${userId} ❌`);
    // Only forget the user if this is still their socket: a newer tab may
    // already have replaced it.
    if (connectedClients.get(userId) === client.id) {
      connectedClients.delete(userId);
    }
  });
}
