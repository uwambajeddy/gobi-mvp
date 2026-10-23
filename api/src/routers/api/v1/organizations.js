import express from "express";
import {
  createOrganization,
  listOrganizations,
  getMyOrganizations,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  listInvitations,
  revokeInvitation,
} from "../../../controllers/organizations.controller";
import { protect } from "../../../middlewares/authentication";
import { validate, validateFilters } from "../../../middlewares/validate";
import { validateIdParams } from "../../../middlewares/validateId";
import {
  createOrganizationSchema,
  addMemberSchema,
  updateMemberRoleSchema,
  organizationFilters,
} from "../../../utils/validationSchemas";

const router = express.Router();

validateIdParams(router, "id", "memberId", "invitationId");
router.use(protect);

router.post("/", validate(createOrganizationSchema), createOrganization);
router.get("/", validateFilters(organizationFilters), listOrganizations);
router.get("/mine", getMyOrganizations);
router.get("/:id/members", listMembers);
router.post("/:id/members", validate(addMemberSchema), addMember);
router.patch("/:id/members/:memberId", validate(updateMemberRoleSchema), updateMemberRole);
router.delete("/:id/members/:memberId", removeMember);
router.get("/:id/invitations", listInvitations);
router.delete("/:id/invitations/:invitationId", revokeInvitation);

export default router;
