import express from "express";
import {
  getDriverProfiles,
  reviewDriverProfile,
  listOrganizations,
  getActivityLogs,
  getStats,
} from "../../../controllers/admin.controller";
import { protect, restrictToType } from "../../../middlewares/authentication";
import { validate, validateFilters } from "../../../middlewares/validate";
import { validateIdParams } from "../../../middlewares/validateId";
import {
  reviewDriverSchema,
  driverProfileFilters,
  organizationFilters,
} from "../../../utils/validationSchemas";

const router = express.Router();

validateIdParams(router, "id");
router.use(protect, restrictToType("admin"));

router.get("/drivers", validateFilters(driverProfileFilters), getDriverProfiles);
router.patch("/drivers/:id", validate(reviewDriverSchema), reviewDriverProfile);

router.get("/organizations", validateFilters(organizationFilters), listOrganizations);
router.get("/activity-logs", getActivityLogs);
router.get("/stats", getStats);

export default router;
