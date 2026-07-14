export type UserType = "user" | "admin";

export type OrgRole = "owner" | "coordinator" | "member" | "driver";

export type CompanyType = "distribution" | "transport" | "clearing_agent";

export type ShipmentStatus =
  | "draft"
  | "submitted"
  | "quote_approved"
  | "awaiting_documents"
  | "documents_complete"
  | "execution_assigned"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "completed"
  | "cancelled";

export type DocumentStatus = "required" | "uploaded" | "verified" | "rejected";

export type EventSource = "manual" | "system";

export type PaymentStatus = "pending" | "paid";

export type ExceptionStatus = "open" | "investigating" | "resolved";

export type ExceptionSeverity = "low" | "medium" | "high" | "critical";

export interface Organization {
  id: number;
  name: string;
  companyType: CompanyType;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
}

export interface Membership {
  id: number;
  userId: number;
  organizationId: number;
  role: OrgRole;
  active: boolean;
  organization?: Organization;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  type: UserType;
  isActive: boolean;
  memberships?: Membership[];
  driverProfile?: DriverProfile | null;
  createdAt?: string;
}

export interface UserSummary {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  email?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface DriverProfile {
  id: number;
  userId: number;
  licenceNumber: string;
  licenceExpiresAt?: string | null;
  status: "pending" | "approved" | "rejected";
  user?: UserSummary;
  createdAt?: string;
}

export interface Vehicle {
  id: number;
  organizationId: number;
  plateNumber: string;
  model: string;
  type: "truck" | "van" | "trailer" | "pickup";
  capacityKg?: number | null;
  insuranceExpiresAt?: string | null;
  inspectionExpiresAt?: string | null;
  yellowCardExpiresAt?: string | null;
}

export interface ShipmentPackage {
  id?: number;
  description: string;
  weightKg: number;
  quantity: number;
}

export interface Shipment {
  id: number;
  reference: string;
  title: string;
  distributionOrgId: number;
  transportOrgId?: number | null;
  clearingAgentOrgId?: number | null;
  createdByUserId: number;
  assignedDriverId?: number | null;
  assignedVehicleId?: number | null;
  originAddress: string;
  destinationAddress: string;
  isCrossBorder: boolean;
  recipientName?: string | null;
  recipientPhone?: string | null;
  quoteAmount?: number | null;
  quoteCurrency?: string;
  quoteApprovedAt?: string | null;
  status: ShipmentStatus;
  podRecipientName?: string | null;
  podNotes?: string | null;
  podCapturedAt?: string | null;
  distributionOrg?: Organization;
  transportOrg?: Organization | null;
  clearingAgentOrg?: Organization | null;
  createdBy?: UserSummary;
  assignedDriver?: UserSummary | null;
  assignedVehicle?: Vehicle | null;
  packages?: ShipmentPackage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ShipmentDocument {
  id: number;
  shipmentId: number;
  docType: string;
  label: string;
  mandatory: boolean;
  fileName?: string | null;
  fileUrl?: string | null;
  status: DocumentStatus;
  rejectionReason?: string | null;
  uploadedByUserId?: number | null;
  uploadedAt?: string | null;
  verifiedByUserId?: number | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
}

export interface ShipmentEvent {
  id: number;
  shipmentId: number;
  eventType: string;
  actorUserId?: number | null;
  occurredAt: string;
  locationName?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  source: EventSource;
  actor?: UserSummary | null;
}

export interface ShipmentPayment {
  id: number;
  shipmentId: number;
  type: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  proofFileName?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  recordedBy?: UserSummary;
  paidAt?: string | null;
  createdAt?: string;
}

export interface ShipmentException {
  id: number;
  shipmentId: number;
  type: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  notes?: string | null;
  resolutionNotes?: string | null;
  openedBy?: UserSummary;
  resolvedBy?: UserSummary | null;
  resolvedAt?: string | null;
  createdAt?: string;
}

export interface ShipmentAccess {
  isAdmin: boolean;
  isShipper: boolean;
  isCarrier: boolean;
  isAgent: boolean;
  isAssignedDriver: boolean;
  isShipperCoordinator: boolean;
  isCarrierCoordinator: boolean;
  isAgentCoordinator: boolean;
  isParty: boolean;
}

export interface DocumentGateResult {
  passed: boolean;
  missing: { docType: string; label: string; status: string; reason: string }[];
}

export interface ComplianceGateResult {
  passed: boolean;
  failures: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  cargoKg: number;
}

export interface ActivityLog {
  id: number;
  actorId?: number | null;
  actorRole?: string | null;
  organizationId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: UserSummary | null;
  organization?: Organization | null;
}

export interface AdminStats {
  users: { total: number };
  organizations: {
    total: number;
    distribution: number;
    transport: number;
    clearingAgents: number;
  };
  driverApprovals: { pending: number };
  shipments: { total: number; active: number; completed: number };
  exceptions: { open: number };
}
