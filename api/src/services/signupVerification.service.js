import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import db from "../database/models";

const { pending_signups } = db;

export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 30;

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
const expiry = () => new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

export const describeSignup = (signup) => ({
  id: signup.handle,
  email: signup.email,
  expiresAt: signup.expiresAt,
  resendAvailableAt: new Date(new Date(signup.lastSentAt).getTime() + RESEND_COOLDOWN_SECONDS * 1000),
});

export const startPendingSignup = async ({ email, firstName, lastName, phoneNumber, passwordHash }) => {
  await pending_signups.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });

  const code = newCode();
  const signup = await pending_signups.create({
    handle: crypto.randomBytes(24).toString("hex"),
    email,
    firstName,
    lastName,
    phoneNumber,
    passwordHash,
    codeHash: await bcrypt.hash(code, 10),
    expiresAt: expiry(),
    lastSentAt: new Date(),
  });
  return { signup, code };
};

export const refreshSignupCode = async (signup) => {
  const code = newCode();
  await signup.update({
    codeHash: await bcrypt.hash(code, 10),
    attempts: 0,
    expiresAt: expiry(),
    lastSentAt: new Date(),
  });
  return code;
};

export const codeMatches = (signup, code) => bcrypt.compare(String(code), signup.codeHash);
