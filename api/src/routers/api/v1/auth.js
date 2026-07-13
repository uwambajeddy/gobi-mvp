import express from "express";
import { register, login, refreshToken } from "../../../controllers/auth.controller";
import { validate } from "../../../middlewares/validate";
import { registerSchema, loginSchema } from "../../../utils/validationSchemas";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refreshToken", refreshToken);

export default router;
