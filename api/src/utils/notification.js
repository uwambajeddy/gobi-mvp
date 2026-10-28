import db from "../database/models";
import { emitToUser } from "./socket.io";

const { notifications } = db;

export const NOTIFICATION_ENTITY_TYPES = {
  SHIPMENT: "shipment",
};

export const createNotification = async (title, content, userId, actionUrl = null, entity = null) => {
  try {
    const notification = await notifications.create({
      userId,
      title,
      content,
      actionUrl,
      entityType: entity?.type || null,
      entityId: entity?.id || null,
    });

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
