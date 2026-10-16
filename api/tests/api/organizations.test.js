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
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";

describe("Organizations & RBAC API", () => {
  it("creates an organization and makes the creator its owner", async () => {
    const { tokens } = await registerUser();

    const res = await asUser(tokens).post("/api/v1/organizations", {
      name: `Test Org ${Date.now()}`,
      companyType: "distribution",
    });

    expect(res).to.have.status(201);
    const orgId = res.body.data.organization.id;

    const mine = await asUser(tokens).get("/api/v1/organizations/mine");
    const membership = mine.body.data.memberships.find((m) => m.organizationId === orgId);
    expect(membership.role).to.equal("owner");
  });

  it("filters the organization directory by company type", async () => {
    const { tokens } = await registerUser();
    const res = await asUser(tokens).get("/api/v1/organizations?companyType=transport");

    expect(res).to.have.status(200);
    expect(res.body.data.organizations).to.not.be.empty;
    res.body.data.organizations.forEach((org) =>
      expect(org.companyType).to.equal("transport"),
    );
  });

  it("lets an owner add an existing user as a member by email", async () => {
    const owner = await registerUser();
    const orgRes = await asUser(owner.tokens).post("/api/v1/organizations", {
      name: `Member Org ${Date.now()}`,
      companyType: "transport",
    });
    const orgId = orgRes.body.data.organization.id;

    const newMember = await registerUser({ email: uniqueEmail("member") });

    const res = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
      email: newMember.user.email,
      role: "coordinator",
    });

    expect(res).to.have.status(201);
    expect(res.body.data.member.role).to.equal("coordinator");
  });

  describe("Invitations for emails without an account", () => {
    const setupOrg = async () => {
      const owner = await registerUser();
      const orgRes = await asUser(owner.tokens).post("/api/v1/organizations", {
        name: `Invite Org ${Date.now()}`,
        companyType: "transport",
      });
      return { owner, orgId: orgRes.body.data.organization.id };
    };

    /** The token only ever travels in the email, so tests read it from the outbox. */
    const invitationToken = async (email) => {
      await flushNotifications();
      const message = [...testOutbox].reverse().find((m) => m.to.email === email);
      return message?.text.match(/\/invite\/([a-f0-9]{64})/)?.[1];
    };

    it("emails an invitation; the person registers, then accepts and joins with the invited role", async () => {
      const { owner, orgId } = await setupOrg();
      const email = uniqueEmail("invitee");

      const invited = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email,
        role: "driver",
      });
      expect(invited).to.have.status(201);
      expect(invited.body.data.invitation.status).to.equal("pending");
      expect(invited.body.data.invitation).to.not.have.property("tokenHash");

      const token = await invitationToken(email);
      expect(token, "invitation email with a link").to.be.a("string");

      // Public preview, before the invitee has an account
      const preview = await chai.request(app).get(`/api/v1/invitations/${token}`);
      expect(preview).to.have.status(200);
      expect(preview.body.data.invitation.organization.id).to.equal(orgId);
      expect(preview.body.data.hasAccount).to.equal(false);

      const invitee = await registerUser({ email });
      const accepted = await asUser(invitee.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(accepted).to.have.status(200);
      expect(accepted.body.data.membership.role).to.equal("driver");

      const mine = await asUser(invitee.tokens).get("/api/v1/organizations/mine");
      expect(mine.body.data.memberships.map((m) => m.organizationId)).to.include(orgId);

      const again = await asUser(invitee.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(again).to.have.status(409);

      const open = await asUser(owner.tokens).get(`/api/v1/organizations/${orgId}/invitations`);
      expect(open.body.data.invitations).to.have.length(0);
    });

    it("only lets the invited email accept", async () => {
      const { owner, orgId } = await setupOrg();
      const email = uniqueEmail("invitee");
      await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, { email, role: "member" });
      const token = await invitationToken(email);

      const someoneElse = await registerUser();
      const res = await asUser(someoneElse.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(res).to.have.status(403);
    });

    it("resends with a fresh link, and a revoked invitation can't be accepted", async () => {
      const { owner, orgId } = await setupOrg();
      const email = uniqueEmail("invitee");

      await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, { email, role: "member" });
      const firstToken = await invitationToken(email);

      const resent = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email,
        role: "coordinator",
      });
      expect(resent.body.data.resent).to.equal(true);
      const secondToken = await invitationToken(email);
      expect(secondToken).to.not.equal(firstToken);

      const stale = await chai.request(app).get(`/api/v1/invitations/${firstToken}`);
      expect(stale).to.have.status(404);

      const open = await asUser(owner.tokens).get(`/api/v1/organizations/${orgId}/invitations`);
      expect(open.body.data.invitations).to.have.length(1);
      expect(open.body.data.invitations[0].role).to.equal("coordinator");

      const revoked = await asUser(owner.tokens).delete(
        `/api/v1/organizations/${orgId}/invitations/${open.body.data.invitations[0].id}`,
      );
      expect(revoked).to.have.status(200);

      const invitee = await registerUser({ email });
      const res = await asUser(invitee.tokens).post(`/api/v1/invitations/${secondToken}/accept`);
      expect(res).to.have.status(400);
    });

    it("keeps invitations visible only to owners and coordinators", async () => {
      const { orgId } = await setupOrg();
      const stranger = await registerUser();
      const res = await asUser(stranger.tokens).get(`/api/v1/organizations/${orgId}/invitations`);
      expect(res).to.have.status(403);
    });
  });

  it("blocks non-members from listing an organization's members", async () => {
    const stranger = await registerUser();
    const res = await asUser(stranger.tokens).get(
      `/api/v1/organizations/${SEED.TRANSPORT_ORG}/members`,
    );
    expect(res).to.have.status(403);
  });

  it("requires a distribution org context to create shipments", async () => {
    // A user with no organization
    const orgless = await registerUser();
    const res = await asUser(orgless.tokens).post("/api/v1/shipments", {
      title: "Should fail",
      originAddress: "A",
      destinationAddress: "B",
      packages: [{ description: "x", weightKg: 1, quantity: 1 }],
    });
    expect(res).to.have.status(400);

    // A transport-org coordinator (wrong company type)
    const coordinator = await loginAs(PERSONAS.COORDINATOR);
    const res2 = await asUser(coordinator.tokens).post("/api/v1/shipments", {
      title: "Should also fail",
      originAddress: "Somewhere long enough",
      destinationAddress: "Elsewhere long enough",
      packages: [{ description: "cargo", weightKg: 10, quantity: 1 }],
    });
    expect(res2).to.have.status(403);
  });
});
