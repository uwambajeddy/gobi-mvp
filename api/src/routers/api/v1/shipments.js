import express from "express";
import {
  createShipment,
  listShipments,
  getShipment,
  updateShipment,
  submitShipment,
  cancelShipment,
  assignCarrier,
  assignClearingAgent,
  submitQuote,
  approveQuote,
  capturePod,
  completeShipment,
} from "../../../controllers/shipments.controller";
import {
  listDocuments,
  uploadDocument,
  verifyDocument,
  rejectDocument,
} from "../../../controllers/shipmentDocuments.controller";
import {
  previewAssignment,
  assignExecution,
} from "../../../controllers/shipmentAssignment.controller";
import { listEvents, recordEvent } from "../../../controllers/shipmentEvents.controller";
import {
  listPayments,
  recordPayment,
  markPaymentPaid,
} from "../../../controllers/shipmentPayments.controller";
import {
  listExceptions,
  openException,
  resolveException,
} from "../../../controllers/shipmentExceptions.controller";
import { protect } from "../../../middlewares/authentication";
import {
  requireMembership,
  requireCompanyType,
} from "../../../middlewares/organizationAuthorization";
import { validate } from "../../../middlewares/validate";
import {
  createShipmentSchema,
  updateShipmentSchema,
  assignCarrierSchema,
  assignClearingAgentSchema,
  submitQuoteSchema,
  uploadDocumentSchema,
  rejectDocumentSchema,
  assignExecutionSchema,
  recordEventSchema,
  capturePodSchema,
  recordPaymentSchema,
  openExceptionSchema,
  resolveExceptionSchema,
} from "../../../utils/validationSchemas";

const router = express.Router();

router.use(protect);

router.post(
  "/",
  requireMembership,
  requireCompanyType("distribution"),
  validate(createShipmentSchema),
  createShipment,
);
router.get("/", listShipments);
router.get("/:id", getShipment);
router.patch("/:id", validate(updateShipmentSchema), updateShipment);
router.post("/:id/submit", submitShipment);
router.post("/:id/cancel", cancelShipment);

router.post("/:id/assign-carrier", validate(assignCarrierSchema), assignCarrier);
router.post("/:id/assign-clearing-agent", validate(assignClearingAgentSchema), assignClearingAgent);
router.post("/:id/quote", validate(submitQuoteSchema), submitQuote);
router.post("/:id/approve-quote", approveQuote);

router.get("/:id/documents", listDocuments);
router.post("/:id/documents", validate(uploadDocumentSchema), uploadDocument);
router.patch("/documents/:docId/verify", verifyDocument);
router.patch("/documents/:docId/reject", validate(rejectDocumentSchema), rejectDocument);

router.get("/:id/assignment-preview", previewAssignment);
router.post("/:id/assign", validate(assignExecutionSchema), assignExecution);

router.get("/:id/events", listEvents);
router.post("/:id/events", validate(recordEventSchema), recordEvent);

router.post("/:id/pod", validate(capturePodSchema), capturePod);
router.post("/:id/complete", completeShipment);

router.get("/:id/payments", listPayments);
router.post("/:id/payments", validate(recordPaymentSchema), recordPayment);
router.patch("/payments/:paymentId/mark-paid", markPaymentPaid);

router.get("/:id/exceptions", listExceptions);
router.post("/:id/exceptions", validate(openExceptionSchema), openException);
router.patch("/exceptions/:exceptionId/resolve", validate(resolveExceptionSchema), resolveException);

export default router;
