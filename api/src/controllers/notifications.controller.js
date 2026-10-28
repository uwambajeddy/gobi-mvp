import statusCodes from "../utils/statusCodes";
import catchAsync from "../utils/catchAsync";
import { successResponse } from "../utils/responseHandlers";
import db from "../database/models";

const { ok } = statusCodes;
const { notifications } = db;

const LATEST_COUNT = 20;

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

export const readNotifications = catchAsync(async (req, res) => {
  await notifications.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });

  return successResponse(res, ok, { message: "Notifications marked as read" });
});

export const readNotification = catchAsync(async (req, res) => {
  await notifications.update({ isRead: true }, { where: { id: req.params.id, userId: req.user.id } });

  return successResponse(res, ok, { message: "Notification marked as read" });
});
