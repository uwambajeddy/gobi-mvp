import express from "express";
import {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
} from "../../../controllers/vehicles.controller";
import { protect } from "../../../middlewares/authentication";
import {
  requireMembership,
  requireCompanyType,
  requireOrgRole,
} from "../../../middlewares/organizationAuthorization";
import { validate } from "../../../middlewares/validate";
import { vehicleSchema, updateVehicleSchema } from "../../../utils/validationSchemas";

const router = express.Router();

router.use(protect, requireMembership, requireCompanyType("transport"));

router.get("/", listVehicles);
router.get("/:id", getVehicle);

router.use(requireOrgRole("owner", "coordinator"));

router.post("/", validate(vehicleSchema), createVehicle);
router.patch("/:id", validate(updateVehicleSchema), updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;
