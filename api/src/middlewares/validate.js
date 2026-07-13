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
