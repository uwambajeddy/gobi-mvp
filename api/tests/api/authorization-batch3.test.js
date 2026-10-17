import { expect } from "chai";
import {
  asUser,
  chai,
  app,
  loginAs,
  registerUser,
  uniqueEmail,
  PERSONAS,
  SEED,
} from "../helpers/auth.helper";
import { createShipment, driveShipmentTo } from "../helpers/shipment.helper";
import { pdfFile } from "../helpers/files.helper";
import { createOrRefreshInvitation } from "../../src/services/invitations.service";
import db from "../../src/database/models";

/**
 * Regression tests for audit findings F-07 (closed shipments take no new
 * reviews, payments or exceptions), F-08 (the driver role exists only in
 * transport organizations) and F-11 (malformed ids are a 400, never a 500).
 */

const S = (id) => `/api/v1/shipments/${id}`;

const firstDocWithStatus = async (tokens, shipmentId, status) =>
  (await asUser(tokens).get(`${S(shipmentId)}/documents`)).body.data.documents.find((d) => d.status === status);

const createOrg = async (companyType) => {
  const owner = await registerUser();
  const res = await asUser(owner.tokens).post("/api/v1/organizations", {
    name: `Batch3 ${companyType} ${Date.now()}`,
    companyType,
  });
  return { owner, orgId: res.body.data.organization.id };
};

const membersOf = async (actor, orgId) =>
  (await asUser(actor.tokens).get(`/api/v1/organizations/${orgId}/members`)).body.data.members;

describe("Security batch 3", () => {
  describe("Closed shipments take no new reviews, payments or exceptions (F-07)", () => {
    it("refuses them on a cancelled shipment, and still lets a pending payment be settled", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("awaiting_documents");
      await asUser(shipper.tokens).upload(`${S(shipment.id)}/documents`, { docType: "packing_list" }, pdfFile());
      const document = await firstDocWithStatus(coordinator.tokens, shipment.id, "uploaded");
      const pending = await asUser(coordinator.tokens).post(`${S(shipment.id)}/payments`, {
        type: "port_fee",
        amount: 12000,
      });
      expect(pending).to.have.status(201);

      expect(await asUser(shipper.tokens).post(`${S(shipment.id)}/cancel`)).to.have.status(200);

      const verify = await asUser(coordinator.tokens).patch(`/api/v1/shipments/documents/${document.id}/verify`);
      expect(verify).to.have.status(400);
      expect(verify.body.message).to.equal("Documents can't be verified on a cancelled shipment.");
      const reject = await asUser(coordinator.tokens).patch(`/api/v1/shipments/documents/${document.id}/reject`, {
        reason: "Too late",
      });
      expect(reject).to.have.status(400);
      const payment = await asUser(coordinator.tokens).post(`${S(shipment.id)}/payments`, {
        type: "other",
        amount: 5,
      });
      expect(payment).to.have.status(400);
      expect(payment.body.message).to.include("cancelled");
      const exception = await asUser(shipper.tokens).post(`${S(shipment.id)}/exceptions`, {
        type: "other",
        severity: "low",
        notes: "After cancellation",
      });
      expect(exception).to.have.status(400);

      // A fee incurred before cancellation can still be settled.
      const settle = await asUser(coordinator.tokens).patch(
        `/api/v1/shipments/payments/${pending.body.data.payment.id}/mark-paid`,
      );
      expect(settle).to.have.status(200);

      const { access } = (await asUser(coordinator.tokens).get(S(shipment.id))).body.data;
      expect(access.can).to.include({
        verifyDocument: false,
        rejectDocument: false,
        recordPayment: false,
        openException: false,
        markPaymentPaid: true,
      });
    });

    it("refuses them on a completed shipment, and still lets a pending payment be settled", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("delivered");
      const pending = await asUser(coordinator.tokens).post(`${S(shipment.id)}/payments`, {
        type: "warehouse_fee",
        amount: 8000,
      });
      expect(pending).to.have.status(201);
      expect(await asUser(shipper.tokens).post(`${S(shipment.id)}/complete`)).to.have.status(200);

      const document = await firstDocWithStatus(coordinator.tokens, shipment.id, "uploaded");
      const verify = await asUser(coordinator.tokens).patch(`/api/v1/shipments/documents/${document.id}/verify`);
      expect(verify).to.have.status(400);
      expect(verify.body.message).to.equal("Documents can't be verified on a completed shipment.");

      const payment = await asUser(coordinator.tokens).post(`${S(shipment.id)}/payments`, {
        type: "other",
        amount: 5,
      });
      expect(payment).to.have.status(400);
      const exception = await asUser(shipper.tokens).post(`${S(shipment.id)}/exceptions`, {
        type: "cargo_damage",
        severity: "high",
        notes: "Found after completion",
      });
      expect(exception).to.have.status(400);
      expect(exception.body.message).to.equal("Exceptions can't be opened on a completed shipment.");

      const settle = await asUser(coordinator.tokens).patch(
        `/api/v1/shipments/payments/${pending.body.data.payment.id}/mark-paid`,
      );
      expect(settle).to.have.status(200);
    });

    it("still allows reviews, payments and exceptions while the shipment is open", async () => {
      const { shipment, shipper, coordinator } = await driveShipmentTo("in_transit");
      const document = await firstDocWithStatus(coordinator.tokens, shipment.id, "uploaded");

      expect(await asUser(coordinator.tokens).patch(`/api/v1/shipments/documents/${document.id}/verify`)).to.have.status(200);
      expect(
        await asUser(coordinator.tokens).post(`${S(shipment.id)}/payments`, { type: "border_fee", amount: 3000 }),
      ).to.have.status(201);
      expect(
        await asUser(shipper.tokens).post(`${S(shipment.id)}/exceptions`, {
          type: "border_queue",
          severity: "low",
          notes: "Queue at the border",
        }),
      ).to.have.status(201);
    });
  });

  describe("The driver role exists only in transport organizations (F-08)", () => {
    it("refuses a driver in a shipper or clearing-agent organization, directly or by invitation", async () => {
      for (const companyType of ["distribution", "clearing_agent"]) {
        const { owner, orgId } = await createOrg(companyType);
        const existing = await registerUser();

        const add = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
          email: existing.user.email,
          role: "driver",
        });
        expect(add, companyType).to.have.status(400);
        expect(add.body.message).to.equal("The driver role is only available in transport organizations.");

        const email = uniqueEmail("driver-invite");
        const invite = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
          email,
          role: "driver",
        });
        expect(invite, companyType).to.have.status(400);

        const open = await asUser(owner.tokens).get(`/api/v1/organizations/${orgId}/invitations`);
        expect(open.body.data.invitations.map((i) => i.email)).to.not.include(email);
        expect((await membersOf(owner, orgId)).map((m) => m.userId)).to.not.include(existing.user.id);

        // Other roles still work there.
        const member = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
          email: existing.user.email,
          role: "member",
        });
        expect(member, companyType).to.have.status(201);
      }
    });

    it("still invites drivers in a transport organization", async () => {
      const { owner, orgId } = await createOrg("transport");
      const existing = await registerUser();

      // Existing accounts are invited too, and join once they accept (F-09, authorization-batch4a.test.js).
      const add = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: existing.user.email,
        role: "driver",
      });
      expect(add).to.have.status(201);
      expect(add.body.data.invitation.role).to.equal("driver");
      const invite = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: uniqueEmail("driver-invite"),
        role: "driver",
      });
      expect(invite).to.have.status(201);
      expect(invite.body.data.invitation.role).to.equal("driver");
    });

    it("refuses changing a role to driver outside a transport organization", async () => {
      const shipperOrg = await createOrg("distribution");
      const person = await registerUser();
      const added = await asUser(shipperOrg.owner.tokens).post(`/api/v1/organizations/${shipperOrg.orgId}/members`, {
        email: person.user.email,
        role: "member",
      });
      const memberId = added.body.data.member.id;

      const toDriver = await asUser(shipperOrg.owner.tokens).patch(
        `/api/v1/organizations/${shipperOrg.orgId}/members/${memberId}`,
        { role: "driver" },
      );
      expect(toDriver).to.have.status(400);
      expect(toDriver.body.message).to.equal("The driver role is only available in transport organizations.");
      expect((await membersOf(shipperOrg.owner, shipperOrg.orgId)).find((m) => m.id === memberId).role).to.equal("member");
      // Inside a transport organization a switch to driver needs the person's consent (F-09, authorization-batch4a.test.js).
    });

    it("refuses an older driver invitation to a non-transport organization", async () => {
      const { owner, orgId } = await createOrg("distribution");
      const email = uniqueEmail("legacy-driver");
      // Created directly, as the API allowed before this rule.
      const { token } = await createOrRefreshInvitation({
        organizationId: orgId,
        email,
        role: "driver",
        invitedByUserId: owner.user.id,
      });

      const invitee = await registerUser({ email });
      const accepted = await asUser(invitee.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(accepted).to.have.status(400);
      expect(accepted.body.message).to.include("only available in transport organizations");
      expect((await membersOf(owner, orgId)).map((m) => m.userId)).to.not.include(invitee.user.id);
    });

    it("leaves an older driver membership powerless, and lets the owner correct it", async () => {
      const { owner, orgId } = await createOrg("distribution");
      const legacy = await registerUser();
      // Created directly, as the API allowed before this rule.
      const membership = await db.organization_members.create({
        userId: legacy.user.id,
        organizationId: orgId,
        role: "driver",
      });
      const draft = await createShipment(owner.tokens);

      expect(await asUser(legacy.tokens).get(S(draft.id))).to.have.status(403);
      expect(
        await asUser(legacy.tokens).patch(S(draft.id), { title: "Edited by a legacy driver" }),
      ).to.have.status(403);

      const fixed = await asUser(owner.tokens).patch(`/api/v1/organizations/${orgId}/members/${membership.id}`, {
        role: "member",
      });
      expect(fixed).to.have.status(200);
      expect(await asUser(legacy.tokens).get(S(draft.id))).to.have.status(200);
    });
  });

  describe("Malformed ids are a 400, never a 500 (F-11)", () => {
    const MALFORMED = ["abc", "1.5", "-1", "0", "1e3", "99999999999"];

    let shipper;
    let coordinator;
    let admin;

    before(async () => {
      shipper = await loginAs(PERSONAS.SHIPPER);
      coordinator = await loginAs(PERSONAS.COORDINATOR);
      admin = await loginAs(PERSONAS.ADMIN);
    });

    it("refuses malformed path ids on every router", async () => {
      const routes = (bad) => [
        [shipper, "get", S(bad)],
        [shipper, "get", `${S(bad)}/documents`],
        [shipper, "get", `${S(bad)}/events`],
        [shipper, "get", `/api/v1/shipments/documents/${bad}/file`],
        [shipper, "get", `/api/v1/shipments/payments/${bad}/proof`],
        [coordinator, "patch", `/api/v1/shipments/exceptions/${bad}/resolve`, { resolutionNotes: "Done" }],
        [shipper, "get", `/api/v1/organizations/${bad}/members`],
        [shipper, "patch", `/api/v1/organizations/${SEED.DISTRIBUTION_ORG}/members/${bad}`, { role: "member" }],
        [shipper, "delete", `/api/v1/organizations/${SEED.DISTRIBUTION_ORG}/invitations/${bad}`],
        [coordinator, "get", `/api/v1/vehicles/${bad}`],
        [admin, "patch", `/api/v1/admin/drivers/${bad}`, { status: "approved" }],
      ];

      for (const bad of MALFORMED) {
        for (const [actor, method, url, body] of routes(bad)) {
          const res = await asUser(actor.tokens)[method](url, body);
          expect(res, `${method.toUpperCase()} ${url}`).to.have.status(400);
          expect(res.body.message, url).to.match(/^Invalid \w+: expected a positive whole number\.$/);
        }
      }
    });

    it("still answers 404 for a well-formed unknown id and 200 for a real one", async () => {
      expect(await asUser(shipper.tokens).get(S(99999999))).to.have.status(404);
      expect(await asUser(coordinator.tokens).get("/api/v1/vehicles/99999999")).to.have.status(404);
      expect(await asUser(coordinator.tokens).get(`/api/v1/vehicles/${SEED.VEHICLE_COMPLIANT}`)).to.have.status(200);
      expect(
        await asUser(shipper.tokens).get(`/api/v1/organizations/${SEED.DISTRIBUTION_ORG}/members`),
      ).to.have.status(200);
    });

    it("authenticates before validating the id", async () => {
      const res = await chai.request(app).get(S("abc"));
      expect(res).to.have.status(401);
    });

    it("refuses out-of-range ids in request bodies and query strings", async () => {
      const draft = await createShipment(shipper.tokens);
      await asUser(shipper.tokens).post(`${S(draft.id)}/submit`);
      const carrier = await asUser(shipper.tokens).post(`${S(draft.id)}/assign-carrier`, {
        transportOrgId: 99999999999,
      });
      expect(carrier).to.have.status(400);

      const { shipment } = await driveShipmentTo("documents_complete");
      const preview = await asUser(coordinator.tokens).get(
        `${S(shipment.id)}/assignment-preview?vehicleId=99999999999&driverId=${SEED.DRIVER_OK_ID}`,
      );
      expect(preview).to.have.status(400);
      const assign = await asUser(coordinator.tokens).post(`${S(shipment.id)}/assign`, {
        vehicleId: 99999999999,
        driverId: SEED.DRIVER_OK_ID,
      });
      expect(assign).to.have.status(400);

      const badFilter = await asUser(admin.tokens).get("/api/v1/admin/activity-logs?entityId=abc");
      expect(badFilter).to.have.status(400);
      const goodFilter = await asUser(admin.tokens).get(`/api/v1/admin/activity-logs?entityId=${shipment.id}`);
      expect(goodFilter).to.have.status(200);
    });
  });
});
