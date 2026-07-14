import { expect } from "chai";
import { chai, app, registerUser, loginAs, PERSONAS } from "../helpers/auth.helper";

describe("Auth & profile API", () => {
  it("registers a new platform user (no operational role at signup)", async () => {
    const email = `register.${Date.now()}@test.gobi.rw`;
    const res = await chai.request(app).post("/api/v1/auth/register").send({
      firstName: "Alice",
      lastName: "Tester",
      email,
      password: "Password123!",
    });

    expect(res).to.have.status(201);
    expect(res.body.data.user.email).to.equal(email);
    expect(res.body.data.user.type).to.equal("user");
    expect(res.body.data.user).to.not.have.property("password");
    expect(res.body.data.tokens).to.have.keys(["accessToken", "refreshToken"]);
  });

  it("rejects duplicate email registration with 409", async () => {
    const { user } = await registerUser();
    const res = await chai.request(app).post("/api/v1/auth/register").send({
      firstName: "Dup",
      lastName: "User",
      email: user.email,
      password: "Password123!",
    });
    expect(res).to.have.status(409);
  });

  it("logs in a seeded coordinator and returns their memberships", async () => {
    const data = await loginAs(PERSONAS.COORDINATOR);
    expect(data.user.memberships).to.have.length(1);
    expect(data.user.memberships[0].role).to.equal("coordinator");
    expect(data.user.memberships[0].organization.companyType).to.equal("transport");
  });

  it("rejects a wrong password with 401", async () => {
    const res = await chai
      .request(app)
      .post("/api/v1/auth/login")
      .send({ email: PERSONAS.SHIPPER, password: "WrongPassword1!" });
    expect(res).to.have.status(401);
  });

  it("issues a new access token for a valid refresh token", async () => {
    const { tokens } = await registerUser();
    const res = await chai
      .request(app)
      .post("/api/v1/auth/refreshToken")
      .send({ refreshToken: tokens.refreshToken });
    expect(res).to.have.status(200);
    expect(res.body.data.accessToken).to.be.a("string");
  });

  it("returns the current profile for an authenticated user", async () => {
    const { user, tokens } = await registerUser();
    const res = await chai
      .request(app)
      .get("/api/v1/profile")
      .set("Authorization", `Bearer ${tokens.accessToken}`);
    expect(res).to.have.status(200);
    expect(res.body.data.user.id).to.equal(user.id);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await chai.request(app).get("/api/v1/profile");
    expect(res).to.have.status(401);
  });
});
