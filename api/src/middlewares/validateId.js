import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";

const { badRequest } = statusCodes;

export const MAX_ID = 2147483647;

export const isValidId = (value) => /^[1-9]\d{0,9}$/.test(String(value ?? "")) && Number(value) <= MAX_ID;

/**
 * `router.param` handler: a malformed id is the client's mistake (400),
 * never a database error (500).
 */
const validateIdParam = (req, res, next, value, name) =>
  isValidId(value)
    ? next()
    : next(new AppError(`Invalid ${name}: expected a positive whole number.`, badRequest));

export const validateIdParams = (router, ...names) =>
  names.forEach((name) => router.param(name, validateIdParam));
