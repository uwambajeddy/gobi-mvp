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
