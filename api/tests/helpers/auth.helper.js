import chai from "chai";
import chaiHttp from "chai-http";
import app from "../../src/app";

chai.use(chaiHttp);

/**
 * Seeded personas (see src/database/seeders):
 *  - admin@gobi.rw        platform admin
 *  - shipper@gobi.rw      owner of Kigali Distribution (org 1, distribution)
 *  - carrier@gobi.rw      owner of TransAfrica Logistics (org 2, transport)
 *  - coordinator@gobi.rw  coordinator at TransAfrica (org 2)
 *  - driver@gobi.rw       driver at TransAfrica (user 5, licence valid)
 *  - driver2@gobi.rw      driver at TransAfrica (user 6, licence EXPIRED)
 *  - agent@gobi.rw        owner of ClearFast Agencies (org 3, clearing_agent)
 *
 * Seeded fleet (org 2): vehicle 1 compliant truck (30t), vehicle 2 insurance
 * EXPIRED, vehicle 3 van without a COMESA Yellow Card.
 */
export const PERSONAS = {
  ADMIN: "admin@gobi.rw",
  SHIPPER: "shipper@gobi.rw",
  CARRIER_OWNER: "carrier@gobi.rw",
  COORDINATOR: "coordinator@gobi.rw",
  DRIVER_OK: "driver@gobi.rw",
  DRIVER_EXPIRED: "driver2@gobi.rw",
  AGENT: "agent@gobi.rw",
};

export const SEED = {
  DISTRIBUTION_ORG: 1,
  TRANSPORT_ORG: 2,
  CLEARING_ORG: 3,
  DRIVER_OK_ID: 5,
  DRIVER_EXPIRED_ID: 6,
  VEHICLE_COMPLIANT: 1,
  VEHICLE_INSURANCE_EXPIRED: 2,
  VEHICLE_VAN_NO_YELLOW_CARD: 3,
};

export const PASSWORD = "Password123!";

let emailCounter = 0;

/** Unique email so tests never collide with seeds or each other. */
export const uniqueEmail = (prefix = "user") =>
  `${prefix}.${Date.now()}.${(emailCounter += 1)}@test.gobi.rw`;

/** Registers a fresh platform user via the API. */
export const registerUser = async (overrides = {}) => {
  const body = {
    firstName: "Test",
    lastName: "User",
    email: uniqueEmail("user"),
    phoneNumber: "+250788123456",
    password: PASSWORD,
    ...overrides,
  };

  const res = await chai.request(app).post("/api/v1/auth/register").send(body);
  if (res.status !== 201) {
    throw new Error(`Test user registration failed: ${JSON.stringify(res.body)}`);
  }
  return { ...res.body.data, password: body.password };
};

/** Logs in and returns `{ user, tokens }`. */
export const loginAs = async (email, password = PASSWORD) => {
  const res = await chai.request(app).post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Test login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
};

/** Authenticated request helper. */
export const asUser = (tokens) => ({
  get: (url) => chai.request(app).get(url).set("Authorization", `Bearer ${tokens.accessToken}`),
  post: (url, body) =>
    chai.request(app).post(url).set("Authorization", `Bearer ${tokens.accessToken}`).send(body),
  patch: (url, body) =>
    chai.request(app).patch(url).set("Authorization", `Bearer ${tokens.accessToken}`).send(body),
  delete: (url) =>
    chai.request(app).delete(url).set("Authorization", `Bearer ${tokens.accessToken}`),
});

export { chai, app };
