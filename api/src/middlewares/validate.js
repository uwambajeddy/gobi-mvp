import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";

const { badRequest } = statusCodes;

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
