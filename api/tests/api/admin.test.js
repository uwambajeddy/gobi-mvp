import { expect } from "chai";
import { asUser, loginAs, registerUser, PERSONAS } from "../helpers/auth.helper";

describe("Platform admin API", () => {
  let adminTokens;

  before(async () => {
    const admin = await loginAs(PERSONAS.ADMIN);
    adminTokens = admin.tokens;
  });

  it("blocks non-admin users from admin endpoints", async () => {
    const coordinator = await loginAs(PERSONAS.COORDINATOR);
    const res = await asUser(coordinator.tokens).get("/api/v1/admin/stats");
    expect(res).to.have.status(403);
  });

  it("reviews driver licence submissions", async () => {
    const driver = await registerUser();
    const submit = await asUser(driver.tokens).post("/api/v1/driver/profile", {
      licenceNumber: `RW-DL-${Date.now()}`,
      licenceExpiresAt: "2028-01-31",
    });
    expect(submit).to.have.status(201);

    const review = await asUser(adminTokens).patch(
      `/api/v1/admin/drivers/${submit.body.data.driverProfile.id}`,
      { status: "approved" },
    );
    expect(review).to.have.status(200);
    expect(review.body.data.driverProfile.status).to.equal("approved");
  });

  it("returns operational platform stats", async () => {
    const res = await asUser(adminTokens).get("/api/v1/admin/stats");

    expect(res).to.have.status(200);
    const { stats } = res.body.data;
    expect(stats.organizations.transport).to.be.at.least(1);
    expect(stats.shipments.total).to.be.a("number");
    expect(stats.exceptions.open).to.be.a("number");
  });

  it("exposes the audit trail with actor and metadata", async () => {
    const res = await asUser(adminTokens).get("/api/v1/admin/activity-logs?limit=20");

    expect(res).to.have.status(200);
    expect(res.body.data.logs).to.not.be.empty;
    const log = res.body.data.logs[0];
    expect(log.action).to.be.a("string");
    expect(log).to.have.property("createdAt");
  });

  it("lists organizations with company-type filter", async () => {
    const res = await asUser(adminTokens).get("/api/v1/admin/organizations?companyType=clearing_agent");

    expect(res).to.have.status(200);
    res.body.data.organizations.forEach((org) =>
      expect(org.companyType).to.equal("clearing_agent"),
    );
  });
});
