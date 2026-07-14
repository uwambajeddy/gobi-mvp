import express from "express";
import {
  submitDriverProfile,
  getMyDriverProfile,
} from "../../../controllers/driver.controller";
import { protect } from "../../../middlewares/authentication";
import { validate } from "../../../middlewares/validate";
import { driverProfileSchema } from "../../../utils/validationSchemas";

const router = express.Router();

router.use(protect);

router.post("/profile", validate(driverProfileSchema), submitDriverProfile);
router.get("/profile", getMyDriverProfile);

export default router;
