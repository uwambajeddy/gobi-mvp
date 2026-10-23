import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";

const { badRequest } = statusCodes;

/**
 * Request-body validation middleware factory.
 * @param {import("joi").ObjectSchema} schema Joi schema for `req.body`
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details
        .map((detail) => detail.message.replace(/['"]/g, ""))
        .join(", ");
      return next(new AppError(message, badRequest));
    }

    req.body = value;
    next();
  };
};

/**
 * List-filter validation middleware factory. Each named query parameter must
 * be one of its allowed values (repeating it filters by several); an absent
 * or empty filter means "no filter", as before.
 * @param {Record<string, string[]>} filters allowed values per query parameter
 */
export const validateFilters = (filters) => {
  return (req, res, next) => {
    for (const [name, allowed] of Object.entries(filters)) {
      const raw = req.query[name];
      if (raw === undefined || raw === "") continue;

      const values = Array.isArray(raw) ? raw : [raw];
      if (!values.every((value) => allowed.includes(value))) {
        return next(new AppError(`Invalid ${name}: expected one of ${allowed.join(", ")}.`, badRequest));
      }
    }
    next();
  };
};
