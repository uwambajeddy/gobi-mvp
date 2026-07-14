import { expect } from "chai";
import {
  asUser,
  loginAs,
  registerUser,
  uniqueEmail,
  PERSONAS,
  SEED,
} from "../helpers/auth.helper";

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

  it("rejects adding a member for an email without an account", async () => {
    const owner = await registerUser();
    const orgRes = await asUser(owner.tokens).post("/api/v1/organizations", {
      name: `Ghost Org ${Date.now()}`,
      companyType: "transport",
    });

    const res = await asUser(owner.tokens).post(
      `/api/v1/organizations/${orgRes.body.data.organization.id}/members`,
      { email: "ghost@nowhere.rw", role: "member" },
    );

    expect(res).to.have.status(404);
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
