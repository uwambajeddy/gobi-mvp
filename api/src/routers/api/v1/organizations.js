import express from "express";
import {
  createOrganization,
  listOrganizations,
  getMyOrganizations,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "../../../controllers/organizations.controller";
import { protect } from "../../../middlewares/authentication";
import { validate } from "../../../middlewares/validate";
import {
  createOrganizationSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} from "../../../utils/validationSchemas";

const router = express.Router();

router.use(protect);

router.post("/", validate(createOrganizationSchema), createOrganization);
router.get("/", listOrganizations);
router.get("/mine", getMyOrganizations);
router.get("/:id/members", listMembers);
router.post("/:id/members", validate(addMemberSchema), addMember);
router.patch("/:id/members/:memberId", validate(updateMemberRoleSchema), updateMemberRole);
router.delete("/:id/members/:memberId", removeMember);

export default router;
