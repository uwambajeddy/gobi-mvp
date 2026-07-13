import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
} from "../../../controllers/profile.controller";
import { protect } from "../../../middlewares/authentication";
import { validate } from "../../../middlewares/validate";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../../../utils/validationSchemas";

const router = express.Router();

router.use(protect);

router.get("/", getProfile);
router.patch("/", validate(updateProfileSchema), updateProfile);
router.patch("/password", validate(changePasswordSchema), changePassword);

export default router;
