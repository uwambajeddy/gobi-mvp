import chai from "chai";
import chaiHttp from "chai-http";
import app from "../../src/app";
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";

chai.use(chaiHttp);

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

export const uniqueEmail = (prefix = "user") =>
  `${prefix}.${Date.now()}.${(emailCounter += 1)}@test.gobi.rw`;

export const verificationCodeFor = async (email) => {
  await flushNotifications();
  const message = [...testOutbox].reverse().find((m) => m.to.email === email && m.tag === "verify_email");
  return message?.text.match(/Your code: (\d{6})/)?.[1];
};

export const registerUser = async (overrides = {}) => {
  const body = {
    firstName: "Test",
    lastName: "User",
    email: uniqueEmail("user"),
    phoneNumber: "+250788123456",
    password: PASSWORD,
    ...overrides,
  };

  const started = await chai.request(app).post("/api/v1/auth/register").send(body);
  if (started.status !== 201) {
    throw new Error(`Test user registration failed: ${JSON.stringify(started.body)}`);
  }
  if (started.body.data.user) {
    return { ...(await loginAs(body.email, body.password)), password: body.password };
  }

  const verified = await chai.request(app).post("/api/v1/auth/verify-email").send({
    verificationId: started.body.data.verification.id,
    code: await verificationCodeFor(body.email),
  });
  if (verified.status !== 201) {
    throw new Error(`Test email verification failed: ${JSON.stringify(verified.body)}`);
  }
  return { ...verified.body.data, password: body.password };
};

export const loginAs = async (email, password = PASSWORD) => {
  const res = await chai.request(app).post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Test login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
};

export const asUser = (tokens) => ({
  get: (url) => chai.request(app).get(url).set("Authorization", `Bearer ${tokens.accessToken}`),
  post: (url, body) =>
    chai.request(app).post(url).set("Authorization", `Bearer ${tokens.accessToken}`).send(body),
  patch: (url, body) =>
    chai.request(app).patch(url).set("Authorization", `Bearer ${tokens.accessToken}`).send(body),
  delete: (url) =>
    chai.request(app).delete(url).set("Authorization", `Bearer ${tokens.accessToken}`),
  upload: (url, fields = {}, file) => {
    let request = chai.request(app).post(url).set("Authorization", `Bearer ${tokens.accessToken}`);
    Object.entries(fields).forEach(([name, value]) => {
      request = request.field(name, value);
    });
    return file ? request.attach("file", file.buffer, { filename: file.name, contentType: file.type }) : request;
  },
});

export { chai, app };
