import express from "express";
import {
  getDriverProfiles,
  reviewDriverProfile,
  listOrganizations,
  getActivityLogs,
  getStats,
} from "../../../controllers/admin.controller";
import { protect, restrictToType } from "../../../middlewares/authentication";
import { validate } from "../../../middlewares/validate";
import { reviewDriverSchema } from "../../../utils/validationSchemas";

const router = express.Router();

router.use(protect, restrictToType("admin"));

router.get("/drivers", getDriverProfiles);
router.patch("/drivers/:id", validate(reviewDriverSchema), reviewDriverProfile);

router.get("/organizations", listOrganizations);
router.get("/activity-logs", getActivityLogs);
router.get("/stats", getStats);

export default router;
