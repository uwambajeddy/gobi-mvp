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
  getDocumentFile,
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
  attachPaymentProof,
  getPaymentProof,
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
import { authorizeShipment } from "../../../middlewares/shipmentAuthorization";
import { validateIdParams } from "../../../middlewares/validateId";
import { validate, validateFilters } from "../../../middlewares/validate";
import { singleFile } from "../../../middlewares/upload";
import { shipmentIncludes } from "../../../services/shipmentAccess.service";
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
  shipmentFilters,
} from "../../../utils/validationSchemas";

const router = express.Router();

const withRelations = { include: shipmentIncludes };
const fromDocument = { from: "document" };
const fromPayment = { from: "payment" };
const fromException = { from: "exception" };

validateIdParams(router, "id", "docId", "paymentId", "exceptionId");
router.use(protect);

router.post(
  "/",
  requireMembership,
  requireCompanyType("distribution"),
  validate(createShipmentSchema),
  createShipment,
);
router.get("/", validateFilters(shipmentFilters), listShipments);
router.get("/:id", authorizeShipment("viewShipment", withRelations), getShipment);
router.patch(
  "/:id",
  validate(updateShipmentSchema),
  authorizeShipment("editDraft", withRelations),
  updateShipment,
);
router.post("/:id/submit", authorizeShipment("submitShipment", withRelations), submitShipment);
router.post("/:id/cancel", authorizeShipment("cancelShipment", withRelations), cancelShipment);

router.post(
  "/:id/assign-carrier",
  validate(assignCarrierSchema),
  authorizeShipment("assignCarrier", withRelations),
  assignCarrier,
);
router.post(
  "/:id/assign-clearing-agent",
  validate(assignClearingAgentSchema),
  authorizeShipment("assignClearingAgent", withRelations),
  assignClearingAgent,
);
router.post(
  "/:id/quote",
  validate(submitQuoteSchema),
  authorizeShipment("submitQuote", withRelations),
  submitQuote,
);
router.post("/:id/approve-quote", authorizeShipment("approveQuote", withRelations), approveQuote);

router.get("/:id/documents", authorizeShipment("listDocuments"), listDocuments);
router.post(
  "/:id/documents",
  authorizeShipment("uploadDocument"),
  singleFile("file"),
  validate(uploadDocumentSchema),
  uploadDocument,
);
router.get(
  "/documents/:docId/file",
  authorizeShipment("viewDocumentFile", fromDocument),
  getDocumentFile,
);
router.patch(
  "/documents/:docId/verify",
  authorizeShipment("verifyDocument", fromDocument),
  verifyDocument,
);
router.patch(
  "/documents/:docId/reject",
  validate(rejectDocumentSchema),
  authorizeShipment("rejectDocument", fromDocument),
  rejectDocument,
);

router.get("/:id/assignment-preview", authorizeShipment("previewAssignment"), previewAssignment);
router.post(
  "/:id/assign",
  validate(assignExecutionSchema),
  authorizeShipment("assignExecution"),
  assignExecution,
);

router.get("/:id/events", authorizeShipment("listEvents"), listEvents);
router.post("/:id/events", validate(recordEventSchema), authorizeShipment("recordEvent"), recordEvent);

router.post(
  "/:id/pod",
  validate(capturePodSchema),
  authorizeShipment("capturePod", withRelations),
  capturePod,
);
router.post("/:id/complete", authorizeShipment("completeShipment", withRelations), completeShipment);

router.get("/:id/payments", authorizeShipment("listPayments"), listPayments);
router.post(
  "/:id/payments",
  authorizeShipment("recordPayment"),
  singleFile("file"),
  validate(recordPaymentSchema),
  recordPayment,
);
router.get(
  "/payments/:paymentId/proof",
  authorizeShipment("viewPaymentProof", fromPayment),
  getPaymentProof,
);
router.post(
  "/payments/:paymentId/proof",
  authorizeShipment("attachPaymentProof", fromPayment),
  singleFile("file"),
  attachPaymentProof,
);
router.patch(
  "/payments/:paymentId/mark-paid",
  authorizeShipment("markPaymentPaid", fromPayment),
  markPaymentPaid,
);

router.get("/:id/exceptions", authorizeShipment("listExceptions"), listExceptions);
router.post(
  "/:id/exceptions",
  validate(openExceptionSchema),
  authorizeShipment("openException"),
  openException,
);
router.patch(
  "/exceptions/:exceptionId/resolve",
  validate(resolveExceptionSchema),
  authorizeShipment("resolveException", fromException),
  resolveException,
);

export default router;
