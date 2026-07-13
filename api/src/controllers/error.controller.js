import AppError from "../utils/appError";
import logger from "../utils/logger";
import codes from "../utils/statusCodes";

const { badRequest, unAuthorized, conflict, serverError } = codes;

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors?.[0]?.path || "field";
  return new AppError(`The provided ${field} is already in use.`, conflict);
};

const handleSequelizeValidationError = () =>
  new AppError("Invalid input data.", badRequest);

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", unAuthorized);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired. Please log in again.", unAuthorized);

export const sendErrorDev = (err, req, res) => {
  logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`);
  if (err.stack) console.error(err.stack);
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

export const sendErrorProd = (err, req, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  logger.error(`ERROR 💥 \n`, err);

  return res.status(serverError).json({
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
};

export default (err, req, res, next) => {
  err.statusCode = err.statusCode || serverError;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    error.message = err.message;

    if (err.name === "SequelizeUniqueConstraintError")
      error = handleSequelizeUniqueConstraintError(err);
    if (err.name === "SequelizeValidationError")
      error = handleSequelizeValidationError();
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  } else {
    sendErrorDev(err, req, res);
  }
};
