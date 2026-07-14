import Joi from "joi";
import { DOCUMENT_TYPE_KEYS } from "../config/shipmentDocuments";
import { MANUAL_EVENT_TYPES } from "../config/shipmentEvents";

// ── Auth & profile ────────────────────────────────────────────────────────────

export const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().trim().lowercase().email().required(),
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^\+?[0-9]{9,15}$/)
    .messages({ "string.pattern.base": "phoneNumber must be a valid phone number" }),
  password: Joi.string().min(8).max(72).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^\+?[0-9]{9,15}$/)
    .messages({ "string.pattern.base": "phoneNumber must be a valid phone number" }),
}).min(1);

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(72).required(),
});

// ── Organizations ─────────────────────────────────────────────────────────────

export const createOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  companyType: Joi.string().valid("distribution", "transport", "clearing_agent").required(),
  contactEmail: Joi.string().trim().lowercase().email(),
  contactPhone: Joi.string().trim().max(20),
  address: Joi.string().trim().max(255),
});

export const addMemberSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  role: Joi.string().valid("owner", "coordinator", "member", "driver").required(),
});

export const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid("owner", "coordinator", "member", "driver").required(),
});

// ── Shipments ─────────────────────────────────────────────────────────────────

const packageSchema = Joi.object({
  description: Joi.string().trim().min(2).max(255).required(),
  weightKg: Joi.number().positive().max(100000).required(),
  quantity: Joi.number().integer().min(1).max(1000).default(1),
});

export const createShipmentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  originAddress: Joi.string().trim().min(3).max(255).required(),
  destinationAddress: Joi.string().trim().min(3).max(255).required(),
  isCrossBorder: Joi.boolean().default(false),
  recipientName: Joi.string().trim().max(120).allow(""),
  recipientPhone: Joi.string().trim().max(20).allow(""),
  packages: Joi.array().items(packageSchema).min(1).required(),
});

export const updateShipmentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255),
  originAddress: Joi.string().trim().min(3).max(255),
  destinationAddress: Joi.string().trim().min(3).max(255),
  isCrossBorder: Joi.boolean(),
  recipientName: Joi.string().trim().max(120).allow(""),
  recipientPhone: Joi.string().trim().max(20).allow(""),
  packages: Joi.array().items(packageSchema).min(1),
}).min(1);

export const assignCarrierSchema = Joi.object({
  transportOrgId: Joi.number().integer().positive().required(),
});

export const assignClearingAgentSchema = Joi.object({
  clearingAgentOrgId: Joi.number().integer().positive().required(),
});

export const submitQuoteSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().trim().uppercase().length(3).default("RWF"),
});

// ── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocumentSchema = Joi.object({
  docType: Joi.string()
    .valid(...DOCUMENT_TYPE_KEYS)
    .required(),
  fileName: Joi.string().trim().min(1).max(255).required(),
  fileUrl: Joi.string().trim().uri().required(),
  expiresAt: Joi.date().iso(),
});

export const rejectDocumentSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

// ── Assignment ────────────────────────────────────────────────────────────────

export const assignExecutionSchema = Joi.object({
  vehicleId: Joi.number().integer().positive().required(),
  driverId: Joi.number().integer().positive().required(),
  overrideDocumentGate: Joi.boolean().default(false),
  overrideComplianceGate: Joi.boolean().default(false),
  overrideReason: Joi.string().trim().min(5).max(500),
}).custom((value, helpers) => {
  if ((value.overrideDocumentGate || value.overrideComplianceGate) && !value.overrideReason) {
    return helpers.message("overrideReason is required when overriding a gate");
  }
  return value;
});

// ── Events ────────────────────────────────────────────────────────────────────

export const recordEventSchema = Joi.object({
  eventType: Joi.string()
    .valid(...MANUAL_EVENT_TYPES)
    .required(),
  occurredAt: Joi.date().iso().max("now"),
  locationName: Joi.string().trim().max(255).allow(""),
  notes: Joi.string().trim().max(2000).allow(""),
  metadata: Joi.object(),
});

// ── POD & completion ──────────────────────────────────────────────────────────

export const capturePodSchema = Joi.object({
  podRecipientName: Joi.string().trim().min(2).max(120).required(),
  podNotes: Joi.string().trim().max(2000).allow(""),
});

// ── Payments ──────────────────────────────────────────────────────────────────

export const recordPaymentSchema = Joi.object({
  type: Joi.string()
    .valid(
      "delivery_order",
      "port_fee",
      "warehouse_fee",
      "border_fee",
      "customs_duty",
      "road_user_charge",
      "other",
    )
    .required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().trim().uppercase().length(3).default("RWF"),
  proofFileName: Joi.string().trim().max(255),
  proofUrl: Joi.string().trim().uri(),
  notes: Joi.string().trim().max(1000).allow(""),
});

// ── Exceptions ────────────────────────────────────────────────────────────────

export const openExceptionSchema = Joi.object({
  type: Joi.string()
    .valid(
      "breakdown",
      "accident",
      "theft",
      "seal_tamper",
      "customs_hold",
      "border_queue",
      "cargo_damage",
      "other",
    )
    .required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").default("medium"),
  notes: Joi.string().trim().min(3).max(2000).required(),
});

export const resolveExceptionSchema = Joi.object({
  resolutionNotes: Joi.string().trim().min(3).max(2000).required(),
});

// ── Fleet & drivers ───────────────────────────────────────────────────────────

export const vehicleSchema = Joi.object({
  plateNumber: Joi.string().trim().min(3).max(20).required(),
  model: Joi.string().trim().min(2).max(100).required(),
  type: Joi.string().valid("truck", "van", "trailer", "pickup").required(),
  capacityKg: Joi.number().positive().max(100000),
  insuranceExpiresAt: Joi.date().iso().allow(null),
  inspectionExpiresAt: Joi.date().iso().allow(null),
  yellowCardExpiresAt: Joi.date().iso().allow(null),
});

export const updateVehicleSchema = Joi.object({
  plateNumber: Joi.string().trim().min(3).max(20),
  model: Joi.string().trim().min(2).max(100),
  type: Joi.string().valid("truck", "van", "trailer", "pickup"),
  capacityKg: Joi.number().positive().max(100000),
  insuranceExpiresAt: Joi.date().iso().allow(null),
  inspectionExpiresAt: Joi.date().iso().allow(null),
  yellowCardExpiresAt: Joi.date().iso().allow(null),
}).min(1);

export const driverProfileSchema = Joi.object({
  licenceNumber: Joi.string().trim().min(5).max(50).required(),
  licenceExpiresAt: Joi.date().iso(),
});

export const reviewDriverSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
});
