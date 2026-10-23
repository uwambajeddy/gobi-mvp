import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import db from "../database/models";

const { pending_signups } = db;

/** How long a code works, how many wrong tries it allows, and the resend cooldown. */
export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 30;

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
const expiry = () => new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

/** What the browser keeps to finish this sign-up; never includes the code. */
export const describeSignup = (signup) => ({
  id: signup.handle,
  email: signup.email,
  expiresAt: signup.expiresAt,
  resendAvailableAt: new Date(new Date(signup.lastSentAt).getTime() + RESEND_COOLDOWN_SECONDS * 1000),
});

/**
 * Starts a sign-up: stores the details (password already hashed) with a fresh
 * code. Several pending sign-ups for one email can coexist; whichever proves
 * the code first creates the account. Returns the row and the raw code.
 */
export const startPendingSignup = async ({ email, firstName, lastName, phoneNumber, passwordHash }) => {
  // Housekeeping: drop sign-ups that can no longer be completed.
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

/** Replaces the code (and resets the attempt count) for a resend. */
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
