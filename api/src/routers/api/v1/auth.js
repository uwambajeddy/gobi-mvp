import express from "express";
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
} from "../../../controllers/auth.controller";
import { validate } from "../../../middlewares/validate";
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
} from "../../../utils/validationSchemas";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/resend-verification", validate(resendVerificationSchema), resendVerification);
router.post("/login", validate(loginSchema), login);
router.post("/refreshToken", refreshToken);

export default router;
