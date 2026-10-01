import jwt from "jsonwebtoken";
import { promisify } from "util";

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
