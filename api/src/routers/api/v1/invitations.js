import express from "express";
import { acceptInvitation, getInvitation } from "../../../controllers/invitations.controller";
import { protect } from "../../../middlewares/authentication";

const router = express.Router();

// Public: the emailed link opens before the invitee has an account.
router.get("/:token", getInvitation);
router.post("/:token/accept", protect, acceptInvitation);

export default router;
