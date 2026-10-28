import db from "../database/models";
import logger from "./logger";
import {
  STAFF_ROLES,
  checkShipmentPolicy,
  getShipmentAccess,
} from "../services/shipmentAccess.service";

const { shipments, organization_members } = db;

let ioInstance = null;

const connectedClients = new Map();

export function initializeSocketIO(io) {
  ioInstance = io;
}

function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized. Call initializeSocketIO first.");
  }
  return ioInstance;
}

export function addConnectedClient(userId, socketId) {
  connectedClients.set(`${userId}`, socketId);
}

function getSocketIdByUserId(userId) {
  return connectedClients.get(`${userId}`) || null;
}

export async function emitToUser(userId, event, data) {
  const socketId = getSocketIdByUserId(userId);
  if (socketId) {
    getIO().to(socketId).emit(event, data);
    return true;
  }
  return false;
}

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

export function shipmentLiveServices(client) {
  client.on("newCoordinates", async (shipmentId, coordinates, timeStamp) => {
    try {
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

      const access = getShipmentAccess(shipment, { user: client.userInfo });
      const denied = checkShipmentPolicy("updateLocation", shipment, access);
      if (denied) throw denied;

      const [lat, lng] = coordinates;
      const lastLocationUpdate = new Date();

      await shipment.update(
        { currentLocation: { lat, lng }, lastLocationUpdate },
        { silent: true },
      );

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

  client.on("disconnect", () => {
    const userId = `${client.userInfo.id}`;
    logger.error(`Client disconnected: ${userId} ❌`);
    if (connectedClients.get(userId) === client.id) {
      connectedClients.delete(userId);
    }
  });
}
