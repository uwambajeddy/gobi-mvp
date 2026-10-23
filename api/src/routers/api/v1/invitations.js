import express from "express";
import { acceptInvitation, getInvitation } from "../../../controllers/invitations.controller";
import { protect } from "../../../middlewares/authentication";

const router = express.Router();

router.get("/:token", getInvitation);
router.post("/:token/accept", protect, acceptInvitation);

export default router;
