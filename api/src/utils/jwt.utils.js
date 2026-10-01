import jwt from "jsonwebtoken";
import { promisify } from "util";

/**
 * Generates an access + refresh token pair for a user.
 * Tokens are stateless JWTs; no server-side session store is used.
 */
export const generateTokens = (id, role) => {
  const accessToken = jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TIME || "15m",
  });

  const refreshToken = jwt.sign({ sub: id, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_TIME || "30d",
  });

  return { accessToken, refreshToken };
};

export const generateAccessToken = (id, role) =>
  jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TIME || "15m",
  });

/**
 * Verifies a JWT and reports validity/expiry without throwing.
 * @param {string} token
 * @param {"access"|"refresh"} type which secret to verify against
 */
export const verifyJwt = async (token, type = "access") => {
  const secret =
    type === "refresh"
      ? process.env.JWT_REFRESH_SECRET
      : process.env.JWT_ACCESS_SECRET;

  try {
    const decoded = await promisify(jwt.verify)(token, secret);
    return { valid: true, expired: false, decoded };
  } catch (e) {
    return {
      valid: false,
      expired: e.message === "jwt expired",
      decoded: null,
    };
  }
};
