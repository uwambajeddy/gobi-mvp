import statusCodes from "../utils/statusCodes";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import db from "../database/models";

const { ok } = statusCodes;
const { notifications } = db;

/** How many notifications the bell menu shows. */
const LATEST_COUNT = 20;

/**
 * GET /api/v1/notifications: the signed-in user's latest notifications
 * (newest first) and how many are unread.
 */
export const getNotifications = catchAsync(async (req, res) => {
  const where = { userId: req.user.id, active: true };

  const [results, unreadCount] = await Promise.all([
    notifications.findAll({
      where,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: LATEST_COUNT,
    }),
    notifications.count({ where: { ...where, isRead: false } }),
  ]);

  return successResponse(res, ok, { results, unreadCount });
});

/**
 * PATCH /api/v1/notifications/read: mark all of the user's notifications as read.
 */
export const readNotifications = catchAsync(async (req, res) => {
  await notifications.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });

  return successResponse(res, ok, { message: "Notifications marked as read" });
});

/**
 * PATCH /api/v1/notifications/read/:id: mark one notification as read.
 * Scoped to the signed-in user, so another user's id changes nothing.
 */
export const readNotification = catchAsync(async (req, res) => {
  await notifications.update({ isRead: true }, { where: { id: req.params.id, userId: req.user.id } });

  return successResponse(res, ok, { message: "Notification marked as read" });
});
