import express from "express";
import {
  getNotifications,
  readNotifications,
  readNotification,
} from "../../../controllers/notifications.controller";
import { protect } from "../../../middlewares/authentication";
import { validateIdParams } from "../../../middlewares/validateId";

const router = express.Router();

validateIdParams(router, "id");
router.use(protect);

router.get("/", getNotifications);
router.patch("/read", readNotifications);
router.patch("/read/:id", readNotification);

export default router;
