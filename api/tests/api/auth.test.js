import { expect } from "chai";
import {
  chai,
  app,
  asUser,
  registerUser,
  loginAs,
  uniqueEmail,
  verificationCodeFor,
  PERSONAS,
} from "../helpers/auth.helper";
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";
import db from "../../src/database/models";

describe("Auth & profile API", () => {
  describe("Sign-up with email verification", () => {
    const signupBody = (email) => ({ firstName: "Alice", lastName: "Tester", email, password: "Password123!" });
    const start = (email) => chai.request(app).post("/api/v1/auth/register").send(signupBody(email));
    const verify = (verificationId, code) =>
      chai.request(app).post("/api/v1/auth/verify-email").send({ verificationId, code });
    const wrongCode = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    it("creates no account until the emailed code is confirmed (no operational role at signup)", async () => {
      const email = uniqueEmail("register");

      const started = await start(email);
      expect(started).to.have.status(201);
      expect(started.body.data).to.not.have.property("user");
      expect(started.body.data.verification.email).to.equal(email);

      // Not an account yet: signing in fails
      const early = await chai.request(app).post("/api/v1/auth/login").send({ email, password: "Password123!" });
      expect(early).to.have.status(401);

      const res = await verify(started.body.data.verification.id, await verificationCodeFor(email));
      expect(res).to.have.status(201);
      expect(res.body.data.user.email).to.equal(email);
      expect(res.body.data.user.type).to.equal("user");
      expect(res.body.data.user).to.not.have.property("password");
      expect(res.body.data.tokens).to.have.keys(["accessToken", "refreshToken"]);

      // The sign-up is used up
      const replay = await verify(started.body.data.verification.id, await verificationCodeFor(email));
      expect(replay).to.have.status(404);
    });

    it("counts wrong codes and locks the code after five", async () => {
      const email = uniqueEmail("register");
      const { id } = (await start(email)).body.data.verification;
      const code = await verificationCodeFor(email);

      const first = await verify(id, wrongCode(code));
      expect(first).to.have.status(400);
      expect(first.body.message).to.include("4 tries left");

      for (let i = 0; i < 4; i += 1) await verify(id, wrongCode(code));
      const locked = await verify(id, code);
      expect(locked).to.have.status(429);
    });

    it("resends a fresh code after the cooldown and rejects the old one", async () => {
      const email = uniqueEmail("register");
      const { id } = (await start(email)).body.data.verification;
      const firstCode = await verificationCodeFor(email);

      const tooSoon = await chai.request(app).post("/api/v1/auth/resend-verification").send({ verificationId: id });
      expect(tooSoon).to.have.status(429);

      // Skip the 30-second wait
      await db.pending_signups.update({ lastSentAt: new Date(Date.now() - 60 * 1000) }, { where: { handle: id } });
      const resent = await chai.request(app).post("/api/v1/auth/resend-verification").send({ verificationId: id });
      expect(resent).to.have.status(200);

      const secondCode = await verificationCodeFor(email);
      if (secondCode !== firstCode) {
        expect((await verify(id, firstCode)).status).to.equal(400);
      }
      expect((await verify(id, secondCode)).status).to.equal(201);
    });

    it("can't be hijacked: a second sign-up for the same email only completes with its own code", async () => {
      const email = uniqueEmail("register");
      const squatter = (await start(email)).body.data.verification.id;
      const squatterCode = await verificationCodeFor(email);
      const owner = (await start(email)).body.data.verification.id;
      const ownerCode = await verificationCodeFor(email);

      if (squatterCode !== ownerCode) {
        expect((await verify(owner, squatterCode)).status).to.equal(400);
      }
      expect((await verify(owner, ownerCode)).status).to.equal(201);
      // The account exists now; the other sign-up is gone
      expect((await verify(squatter, squatterCode)).status).to.equal(404);
    });

    it("creates the account at once from an invitation for the same email", async () => {
      const owner = await registerUser();
      const orgRes = await asUser(owner.tokens).post("/api/v1/organizations", {
        name: `Invite Signup Org ${Date.now()}`,
        companyType: "transport",
      });
      const email = uniqueEmail("invitee");
      await asUser(owner.tokens).post(`/api/v1/organizations/${orgRes.body.data.organization.id}/members`, {
        email,
        role: "member",
      });
      await flushNotifications();
      const inviteToken = [...testOutbox]
        .reverse()
        .find((m) => m.to.email === email && m.tag === "member_invited")
        .text.match(/\/invite\/([a-f0-9]{64})/)[1];

      const res = await chai.request(app).post("/api/v1/auth/register").send({ ...signupBody(email), inviteToken });
      expect(res).to.have.status(201);
      expect(res.body.data.user.email).to.equal(email);

      // An invitation for someone else doesn't skip verification
      const other = await chai
        .request(app)
        .post("/api/v1/auth/register")
        .send({ ...signupBody(uniqueEmail("other")), inviteToken });
      expect(other.body.data).to.have.property("verification");
    });
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
