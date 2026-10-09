import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";

/**
 * Document file storage.
 *
 * Files go to Cloudinary as `authenticated` assets, so they are never
 * publicly reachable. Viewing always goes through `signedFileUrl`, which
 * returns a download link that expires after a few minutes; the API only
 * hands it out after checking that the caller is a party to the shipment.
 *
 * Tests use an in-memory driver so they never touch Cloudinary.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Accepted types, identified by their leading bytes rather than the client's claim. */
const FILE_TYPES = [
  { mimeType: "application/pdf", extension: "pdf", resourceType: "raw", magic: [0x25, 0x50, 0x44, 0x46] },
  { mimeType: "image/png", extension: "png", resourceType: "image", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: "image/jpeg", extension: "jpg", resourceType: "image", magic: [0xff, 0xd8, 0xff] },
];

export const ACCEPTED_MIME_TYPES = FILE_TYPES.map((type) => type.mimeType);

/** The file's real type from its content, or null when it is not an accepted type. */
export const detectFileType = (buffer) =>
  FILE_TYPES.find((type) => type.magic.every((byte, index) => buffer?.[index] === byte)) || null;

/** A display-safe original file name: no path parts or control characters. */
export const cleanFileName = (name = "", fallback = "document") =>
  name
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(-255) || fallback;

const SIGNED_URL_TTL_SECONDS = 300;

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );

/** "memory" in tests, "cloudinary" when configured, otherwise "disabled". */
export const storageMode = () => {
  if (process.env.NODE_ENV === "test") return "memory";
  return isCloudinaryConfigured() ? "cloudinary" : "disabled";
};

let configured = false;
const client = () => {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
};

const memoryStore = new Map();

/**
 * Stores a file and returns where it lives.
 * @param {{buffer: Buffer}} file multer file (memory storage)
 * @param {{folder: string}} options
 * @returns {Promise<{key, resourceType, mimeType, size}>}
 */
export const storeFile = async (file, { folder }) => {
  const type = detectFileType(file.buffer);
  if (!type) throw new Error("Unsupported file type.");

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const stored = { resourceType: type.resourceType, mimeType: type.mimeType, size: file.buffer.length };

  if (storageMode() === "memory") {
    const key = `${folder}/${name}.${type.extension}`;
    memoryStore.set(key, file.buffer);
    return { ...stored, key };
  }

  const result = await new Promise((resolve, reject) => {
    client()
      .uploader.upload_stream(
        {
          folder,
          // Raw assets keep their extension in the public id; images get it as `format`.
          public_id: type.resourceType === "raw" ? `${name}.${type.extension}` : name,
          resource_type: type.resourceType,
          type: "authenticated",
          overwrite: false,
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      )
      .end(file.buffer);
  });

  return { ...stored, key: result.public_id, size: result.bytes };
};

/**
 * A short-lived link to view a stored file.
 * @returns {{url: string, expiresAt: string}}
 */
export const signedFileUrl = ({ fileKey, fileResourceType, fileMimeType }) => {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();

  if (storageMode() === "memory") {
    return { url: `https://files.test.gobi/${fileKey}?expires=${expiresAtSeconds}`, expiresAt };
  }

  const format =
    fileResourceType === "raw" ? "" : FILE_TYPES.find((type) => type.mimeType === fileMimeType)?.extension;
  const url = client().utils.private_download_url(fileKey, format || "", {
    resource_type: fileResourceType,
    type: "authenticated",
    expires_at: expiresAtSeconds,
  });
  return { url, expiresAt };
};
