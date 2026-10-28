import db from "../database/models";
import { emitToUser } from "./socket.io";

const { notifications } = db;

/**
 * Supported entity types for notifications
 * Frontend uses these to determine navigation routes
 */
export const NOTIFICATION_ENTITY_TYPES = {
  SHIPMENT: "shipment",
};

/**
 * Create a notification with entity-based navigation
 *
 * Stores the notification for the bell menu and pushes it live as
 * `newNotification` when the recipient is connected. Same as the commercial
 * platform's createNotification, without notification types and SMS; the
 * MVP's emails are sent by services/notifications.service.
 *
 * @param {string} title - Notification title
 * @param {string} content - Notification message content
 * @param {number} userId - Recipient user ID
 * @param {string|null} actionUrl - Full URL for links outside the app (email)
 * @param {Object|null} entity - Entity reference for in-app navigation
 * @param {string} entity.type - Entity type (use NOTIFICATION_ENTITY_TYPES)
 * @param {number} entity.id - Entity ID
 */
export const createNotification = async (title, content, userId, actionUrl = null, entity = null) => {
  try {
    // Store notification in database
    const notification = await notifications.create({
      userId,
      title,
      content,
      actionUrl,
      entityType: entity?.type || null,
      entityId: entity?.id || null,
    });

    // In-app notification: send entity reference, frontend handles routing.
    // Offline users see it in the bell menu next time they open the app.
    await emitToUser(userId, "newNotification", {
      id: notification.id,
      title,
      content,
      entityType: entity?.type || null,
      entityId: entity?.id || null,
    });
  } catch (error) {
    console.error("Error on create notification:", error);
  }
};
