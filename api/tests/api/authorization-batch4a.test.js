import { expect } from "chai";
import { asUser, loginAs, registerUser, PERSONAS, SEED } from "../helpers/auth.helper";
import { createShipment } from "../helpers/shipment.helper";
import { enrollDriver, invitationToken } from "../helpers/organization.helper";
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";
import {
  shipmentFilters,
  organizationFilters,
  driverProfileFilters,
} from "../../src/utils/validationSchemas";
import db from "../../src/database/models";

/**
 * Regression tests for audit finding F-09 (nobody becomes a carrier's driver
 * without accepting) and for list filters with invalid enum values (400, not 500).
 */

const S = (id) => `/api/v1/shipments/${id}`;

/** A fresh carrier, its own vehicle, and a submitted shipment offered to it. */
const carrierWithShipment = async () => {
  const shipper = await loginAs(PERSONAS.SHIPPER);
  const owner = await registerUser();
  const org = await asUser(owner.tokens).post("/api/v1/organizations", {
    name: `Batch4A Carrier ${Date.now()}`,
    companyType: "transport",
  });
  const orgId = org.body.data.organization.id;
  const vehicle = await asUser(owner.tokens).post("/api/v1/vehicles", {
    plateNumber: `CZ${String(Date.now()).slice(-6)}`,
    model: "Test truck",
    type: "truck",
    capacityKg: 30000,
    insuranceExpiresAt: "2030-01-01",
    inspectionExpiresAt: "2030-01-01",
  });

  const shipment = await createShipment(shipper.tokens);
  await asUser(shipper.tokens).post(`${S(shipment.id)}/submit`);
  await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-carrier`, { transportOrgId: orgId });

  return { owner, orgId, vehicleId: vehicle.body.data.vehicle.id, shipment };
};

const preview = (tokens, shipmentId, vehicleId, driverId) =>
  asUser(tokens).get(`${S(shipmentId)}/assignment-preview?vehicleId=${vehicleId}&driverId=${driverId}`);

const membersOf = async (actor, orgId) =>
  (await asUser(actor.tokens).get(`/api/v1/organizations/${orgId}/members`)).body.data.members;

describe("Security batch 4A", () => {
  describe("Nobody becomes a carrier's driver without accepting (F-09)", () => {
    it("invites another carrier's approved driver instead of enrolling them", async () => {
      const { owner, orgId, vehicleId, shipment } = await carrierWithShipment();

      const add = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: PERSONAS.DRIVER_OK,
        role: "driver",
      });
      expect(add).to.have.status(201);
      expect(add.body.data).to.not.have.property("member");
      expect(add.body.data.invitation).to.include({ email: PERSONAS.DRIVER_OK, role: "driver", status: "pending" });

      // Not a member, so the carrier cannot use their approved licence.
      expect((await membersOf(owner, orgId)).map((m) => m.userId)).to.not.include(SEED.DRIVER_OK_ID);
      const gate = await preview(owner.tokens, shipment.id, vehicleId, SEED.DRIVER_OK_ID);
      expect(gate).to.have.status(400);

      const driver = await loginAs(PERSONAS.DRIVER_OK);
      const mine = (await asUser(driver.tokens).get("/api/v1/organizations/mine")).body.data.memberships;
      expect(mine.map((m) => m.organizationId)).to.deep.equal([SEED.TRANSPORT_ORG]);

      await flushNotifications();
      const email = [...testOutbox].reverse().find((m) => m.to.email === PERSONAS.DRIVER_OK && m.tag === "member_invited");
      expect(email.text).to.include("Sign in to Gobi with this email address");

      // Leave the seeded driver with no open invitation.
      const revoke = await asUser(owner.tokens).delete(
        `/api/v1/organizations/${orgId}/invitations/${add.body.data.invitation.id}`,
      );
      expect(revoke).to.have.status(200);
    });

    it("lets a driver join, licence included, once they accept", async () => {
      const { owner, orgId, vehicleId, shipment } = await carrierWithShipment();
      const admin = await loginAs(PERSONAS.ADMIN);

      const person = await registerUser();
      const profile = await asUser(person.tokens).post("/api/v1/driver/profile", {
        licenceNumber: `RW-${Date.now()}`,
        licenceExpiresAt: "2030-12-31",
      });
      await asUser(admin.tokens).patch(`/api/v1/admin/drivers/${profile.body.data.driverProfile.id}`, {
        status: "approved",
      });

      await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: person.user.email,
        role: "driver",
      });
      expect(await preview(owner.tokens, shipment.id, vehicleId, person.user.id)).to.have.status(400);

      const token = await invitationToken(person.user.email);
      const accepted = await asUser(person.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(accepted).to.have.status(200);
      expect(accepted.body.data.membership.role).to.equal("driver");

      const gate = await preview(owner.tokens, shipment.id, vehicleId, person.user.id);
      expect(gate).to.have.status(200);
      expect(gate.body.data.complianceGate.passed).to.equal(true);
    });

    it("refuses switching an existing member to driver, and lets them rejoin as a driver by accepting", async () => {
      const { owner, orgId } = await carrierWithShipment();
      const person = await registerUser();

      const added = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: person.user.email,
        role: "member",
      });
      expect(added).to.have.status(201);
      const memberId = added.body.data.member.id;

      const toDriver = await asUser(owner.tokens).patch(`/api/v1/organizations/${orgId}/members/${memberId}`, {
        role: "driver",
      });
      expect(toDriver).to.have.status(400);
      expect(toDriver.body.message).to.include("has to accept");
      expect((await membersOf(owner, orgId)).find((m) => m.id === memberId).role).to.equal("member");

      // The documented path: remove, then add as a driver, then the person accepts.
      expect(await asUser(owner.tokens).delete(`/api/v1/organizations/${orgId}/members/${memberId}`)).to.have.status(200);
      const membership = await enrollDriver(owner, orgId, person);
      expect(membership).to.include({ id: memberId, role: "driver", active: true });
    });

    it("refuses a driver invitation for someone who is already a member", async () => {
      const { owner, orgId } = await carrierWithShipment();
      const person = await registerUser();
      await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: person.user.email,
        role: "member",
      });

      const asDriver = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: person.user.email,
        role: "driver",
      });
      expect(asDriver).to.have.status(409);
    });

    it("keeps other roles instant for existing accounts, and moving a driver to another role allowed", async () => {
      const { owner, orgId } = await carrierWithShipment();

      const colleague = await registerUser();
      const coordinator = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: colleague.user.email,
        role: "coordinator",
      });
      expect(coordinator).to.have.status(201);
      expect(coordinator.body.data.member).to.include({ role: "coordinator", active: true });

      const driver = await registerUser();
      const membership = await enrollDriver(owner, orgId, driver);
      const toMember = await asUser(owner.tokens).patch(`/api/v1/organizations/${orgId}/members/${membership.id}`, {
        role: "member",
      });
      expect(toMember).to.have.status(200);
    });
  });

  describe("List filters with invalid values are a 400, not a 500", () => {
    let shipper;
    let admin;

    before(async () => {
      shipper = await loginAs(PERSONAS.SHIPPER);
      admin = await loginAs(PERSONAS.ADMIN);
    });

    it("refuses invalid enum filters on all four list routes", async () => {
      const cases = [
        [shipper, "/api/v1/shipments?status=bogus", "status"],
        [shipper, "/api/v1/organizations?companyType=bogus", "companyType"],
        [admin, "/api/v1/admin/drivers?status=bogus", "status"],
        [admin, "/api/v1/admin/organizations?companyType=bogus", "companyType"],
        [shipper, "/api/v1/shipments?status=draft&status=bogus", "status"],
        [shipper, "/api/v1/shipments?status[nested]=draft", "status"],
      ];

      for (const [actor, url, filter] of cases) {
        const res = await asUser(actor.tokens).get(url);
        expect(res, url).to.have.status(400);
        expect(res.body.message, url).to.match(new RegExp(`^Invalid ${filter}: expected one of [a-z_, ]+\\.$`));
      }
    });

    it("keeps valid, repeated and empty filters working as before", async () => {
      const list = async (actor, url) => {
        const res = await asUser(actor.tokens).get(url);
        expect(res, url).to.have.status(200);
        return res.body.data;
      };

      const drafts = (await list(shipper, "/api/v1/shipments?status=draft")).shipments;
      expect(drafts).to.not.be.empty;
      drafts.forEach((s) => expect(s.status).to.equal("draft"));

      const two = (await list(shipper, "/api/v1/shipments?status=draft&status=completed")).shipments;
      two.forEach((s) => expect(["draft", "completed"]).to.include(s.status));
      expect(two.length).to.be.greaterThan(drafts.length - 1);

      const all = (await list(shipper, "/api/v1/shipments")).shipments;
      const empty = (await list(shipper, "/api/v1/shipments?status=")).shipments;
      expect(empty.length).to.equal(all.length);

      const carriers = (await list(shipper, "/api/v1/organizations?companyType=transport")).organizations;
      expect(carriers).to.not.be.empty;
      carriers.forEach((o) => expect(o.companyType).to.equal("transport"));

      const approved = (await list(admin, "/api/v1/admin/drivers?status=approved")).driverProfiles;
      expect(approved).to.not.be.empty;
      approved.forEach((p) => expect(p.status).to.equal("approved"));

      const agents = (await list(admin, "/api/v1/admin/organizations?companyType=clearing_agent")).organizations;
      expect(agents).to.not.be.empty;
      agents.forEach((o) => expect(o.companyType).to.equal("clearing_agent"));
    });

    it("allows exactly the values the database enums define", () => {
      expect(shipmentFilters.status).to.deep.equal(db.shipments.rawAttributes.status.values);
      expect(organizationFilters.companyType).to.deep.equal(db.organizations.rawAttributes.companyType.values);
      expect(driverProfileFilters.status).to.deep.equal(db.driver_profiles.rawAttributes.status.values);
    });
  });
});
