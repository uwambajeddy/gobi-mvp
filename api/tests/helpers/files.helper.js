/** Tiny but genuine files for upload tests (identified by their leading bytes). */

export const SAMPLE_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

export const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const SAMPLE_TEXT = Buffer.from("This is not a PDF.");

export const pdfFile = (name = "document.pdf") => ({ buffer: SAMPLE_PDF, name, type: "application/pdf" });
