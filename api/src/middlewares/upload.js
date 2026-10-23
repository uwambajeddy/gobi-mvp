import multer from "multer";
import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import { ACCEPTED_MIME_TYPES, MAX_FILE_BYTES } from "../services/fileStorage.service";

const { badRequest } = statusCodes;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) =>
    ACCEPTED_MIME_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new AppError("Upload a PDF, JPG or PNG file.", badRequest)),
});

export const singleFile = (field) => (req, res, next) =>
  parser.single(field)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof AppError) return next(error);
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Files must be 10 MB or smaller.", badRequest));
    }
    return next(new AppError("Could not read the uploaded file.", badRequest));
  });
