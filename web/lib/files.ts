/** Upload rules shared by document and payment-proof uploads; the API enforces the same. */
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const FILE_INPUT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_RULES_HINT = "PDF, JPG or PNG, up to 10 MB.";

/** Why a picked file can't be uploaded, or undefined when it can. */
export const fileProblem = (file: File) => {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return "Choose a PDF, JPG or PNG file.";
  if (file.size > MAX_FILE_BYTES) return "Files must be 10 MB or smaller.";
  return undefined;
};

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Short-lived link the API signs for a stored file. */
export interface StoredFileLink {
  url: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}
