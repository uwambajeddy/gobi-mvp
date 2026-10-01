# Gobi MVP: Operational Shipment Coordination Platform

An operational coordination workspace for logistics companies managing domestic and cross-border freight, built as a university capstone project.

Gobi is **not** a courier app, ride-hailing platform or trucking marketplace. It is the system coordinators use to run shipments: one lifecycle, one structured event timeline, one document checklist, compliance gates before dispatch, a payments ledger and a full audit trail. It replaces the WhatsApp messages, phone calls and spreadsheets that coordinate freight today.

> **Design principle: manual first, integration ready.** Coordinators record operational events by hand today. Future GPS, customs or payment integrations write the *same* structured events automatically, so the workflow never changes.

## Architecture

```
gobi-mvp/
├── api/    Express 4 + Sequelize 6 + PostgreSQL REST API (JWT + org RBAC, gates, audit log, Swagger, Mocha tests)
├── web/    Next.js 14 (App Router) + TypeScript + Tailwind operations workspace (NextAuth, React Query)
└── docker-compose.yml   PostgreSQL 16 with dev + test databases
```

```mermaid
erDiagram
    users ||--o{ organization_members : "belongs to orgs"
    organizations ||--o{ organization_members : "has members"
    users ||--o| driver_profiles : "driver licence"
    organizations ||--o{ vehicles : "fleet"
    organizations ||--o{ shipments : "shipper / carrier / agent"
    users ||--o{ shipments : "assigned driver"
    vehicles ||--o{ shipments : "assigned vehicle"
    shipments ||--o{ shipment_packages : "cargo"
    shipments ||--o{ shipment_documents : "checklist"
    shipments ||--o{ shipment_events : "timeline"
    shipments ||--o{ shipment_payments : "ledger"
    shipments ||--o{ shipment_exceptions : "incidents"
    users ||--o{ activity_logs : "audit trail"

    organizations {
        int id PK
        string name
        enum companyType "distribution | transport | clearing_agent"
    }
    organization_members {
        enum role "owner | coordinator | member | driver"
    }
    shipments {
        string reference UK "GB-2026-0001"
        int distributionOrgId FK "shipper"
        int transportOrgId FK "carrier"
        int clearingAgentOrgId FK
        boolean isCrossBorder
        enum status "draft ... completed"
    }
    shipment_documents {
        string docType
        boolean mandatory
        enum status "required | uploaded | verified | rejected"
    }
    shipment_events {
        enum eventType "31 types"
        enum source "manual | system"
        datetime occurredAt
    }
    vehicles {
        float capacityKg
        date insuranceExpiresAt
        date inspectionExpiresAt
        date yellowCardExpiresAt
    }
```

## The operational model

**Lifecycle** (condensed from the commercial 12-phase model; clearance, border and warehouse milestones live inside `in_transit` as events):

```
draft → submitted → quote_approved → awaiting_documents ⇄ documents_complete
      → execution_assigned → in_transit → arrived → delivered → completed
```

**Actors.** Every party works from the same shipment record:

| Actor | Representation | Responsibilities |
|---|---|---|
| Distribution company (shipper) | org `companyType=distribution` | Create shipments, upload commercial docs, approve quotes, confirm receipt |
| Transport company (carrier) | org `companyType=transport` | Quote, verify documents, assign vehicle+driver (gated), execute, record events, POD |
| Clearing agent | org `companyType=clearing_agent` | Customs milestones, clearance documents, duty payments |
| Coordinator | org member role `coordinator`/`owner` | The primary user, who orchestrates everything above |
| Driver | org member role `driver` + verified licence | Optional participant; coordinators can record events on their behalf |
| Receiver | plain fields + POD | Not a user; signs physically and is captured in the POD block |
| Platform admin | `users.type=admin` | Driver verification, org registry, audit trail, stats |

**The three control mechanisms:**

1. **Document Gate:** quote approval seeds a required-documents checklist (10 types; customs & corridor docs only for cross-border). Every mandatory document must be uploaded/verified and unexpired before dispatch. A rejection regresses `documents_complete` → `awaiting_documents`.
2. **Compliance Gate:** assignment is blocked on: unverified driver, expired licence, expired insurance/inspection, expired COMESA Yellow Card (cross-border), payload over vehicle capacity, or cargo above the 56,000 kg EAC GVW limit. Overrides require a written reason and are **permanently audited** with the exact failures at dispatch time.
3. **Closure rule:** completion requires POD captured and no open exceptions.

**Structured events:** 31 typed milestones (17 system-written, 14 manually recordable: pickup, checkpoints, border approached/cleared, customs submitted/released, warehouse arrived/released, arrival...). Each records who, when, where, notes and `source: manual|system`.

## Getting started

Prerequisites: Node.js 18+, Docker Desktop.

```bash
# 1. Database: creates gobi_mvp_dev + gobi_mvp_test on localhost:5433
docker compose up -d

# 2. API
cd api
npm install
cp .env.example .env
cp .env.test.example .env.test
npm run aio          # migrate + seed + start on http://localhost:8080

# 3. Web (new terminal)
cd web
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000

# 4. Tests
cd api
npm run test:ci      # prepares the test DB then runs the Mocha suite
```

Swagger documentation: http://localhost:8080/api/v1/docs

## Seeded demo accounts

All passwords: `Password123!`

| Email | Persona |
|---|---|
| admin@gobi.rw | Platform admin (driver approvals, audit log, stats) |
| shipper@gobi.rw | Owner, **Kigali Distribution** (shipper) |
| carrier@gobi.rw | Owner, **TransAfrica Logistics** (carrier) |
| coordinator@gobi.rw | Coordinator at TransAfrica (the primary user) |
| driver@gobi.rw | Driver, licence valid ✅ |
| driver2@gobi.rw | Driver, licence **expired** ⛔ (compliance-gate demo) |
| agent@gobi.rw | Owner, **ClearFast Agencies** (clearing agent) |

Seeded fleet: `RAE 001 T` fully compliant · `RAE 002 T` insurance **expired** ⛔ · `RAE 003 V` van without a Yellow Card.

Seeded shipments: `GB-2026-0001` completed (full history) · `GB-2026-0002` cross-border **in transit** mid-corridor · `GB-2026-0003` awaiting documents (one rejected) · `GB-2026-0004` submitted with quote · `GB-2026-0005` draft.

## Demo walkthrough

1. **Shipper** (`shipper@gobi.rw`): create a cross-border shipment with packages → submit → assign TransAfrica as carrier and ClearFast as clearing agent.
2. **Coordinator** (`coordinator@gobi.rw`): submit a quote. **Shipper**: approve it and the document checklist appears.
3. Upload the mandatory documents (any party); **coordinator** verifies each one. Watch the Document Gate flip to green and the status advance to *Documents complete*. Reject one to see it regress.
4. **Coordinator** → Assignment tab: pick the expired-insurance truck + expired-licence driver and the Compliance Gate **blocks** with exact failures. Either fix the pairing (RAE 001 T + driver@) or override with a written reason (audited).
5. Record the corridor journey on the Timeline: *picked up* (status → in transit), *border approached*, *border cleared* ("Truck crossed Rusumo at 15:42"), *customs released*, *arrived at destination*.
6. Capture **POD** → shipper confirms receipt → *completed*. Try completing with an open exception first to see the closure rule.
7. **Admin** (`admin@gobi.rw`): review the audit log. Every action above is there with actor, role, organization and the gate-override evidence.

## API overview

Base URL: `http://localhost:8080/api/v1`. Full spec at `/api/v1/docs`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refreshToken` |
| Organizations | `POST/GET /organizations`, `GET /organizations/mine`, `GET/POST /organizations/:id/members` |
| Shipment lifecycle | `POST/GET /shipments`, `GET/PATCH /shipments/:id`, `POST /shipments/:id/submit\|cancel` |
| Award | `POST /shipments/:id/assign-carrier\|assign-clearing-agent\|quote\|approve-quote` |
| Documents | `GET/POST /shipments/:id/documents`, `PATCH /shipments/documents/:docId/verify\|reject` |
| Assignment | `GET /shipments/:id/assignment-preview`, `POST /shipments/:id/assign` (gates + audited override) |
| Timeline | `GET/POST /shipments/:id/events` |
| POD & closure | `POST /shipments/:id/pod`, `POST /shipments/:id/complete` |
| Payments | `GET/POST /shipments/:id/payments`, `PATCH /shipments/payments/:id/mark-paid` |
| Exceptions | `GET/POST /shipments/:id/exceptions`, `PATCH /shipments/exceptions/:id/resolve` |
| Fleet | `GET/POST/PATCH/DELETE /vehicles` |
| Driver | `GET/POST /driver/profile` |
| Admin | `GET/PATCH /admin/drivers`, `GET /admin/organizations`, `GET /admin/activity-logs`, `GET /admin/stats` |

Multi-org users select their acting organization with the `x-organization-id` header (set automatically by the web app's org switcher).

## Tech stack

**Backend:** Express 4, Sequelize 6 (PostgreSQL), JWT auth with organization-scoped RBAC, Joi validation, service-layer gates (document / compliance), immutable `activity_logs`, Swagger UI, Babel, Mocha + Chai + chai-http + nyc.

**Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, NextAuth (credentials), TanStack React Query, React Hook Form + Zod, Axios with org-context header, Lucide icons.

## License

ISC (academic project).
