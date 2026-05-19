import path from "node:path";

import { UploadTooLargeError, ValidationError } from "@/server/errors/application-error";

const acceptedPdfMimeTypes = new Set(["application/pdf", "application/x-pdf", "application/octet-stream", ""]);

export type UploadValidationConfig = {
  maxUploadBytes: number;
  maxUploadMb: number;
};

export function validateUploadedPdf(value: FormDataEntryValue | null, config: UploadValidationConfig): File {
  const fields: Record<string, string> = {};

  if (!(value instanceof File)) {
    fields.file = "A PDF file is required.";
    throw new ValidationError(fields);
  }

  const originalFileName = value.name.trim();
  const extension = path.extname(originalFileName).toLowerCase();

  if (!originalFileName) {
    fields.file = "File name is required.";
  } else if (extension !== ".pdf") {
    fields.file = "Only PDF files are accepted.";
  } else if (!acceptedPdfMimeTypes.has(value.type.toLowerCase())) {
    fields.file = "File MIME type must be application/pdf.";
  }

  if (value.size === 0) {
    fields.file = "PDF file must not be empty.";
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError(fields);
  }

  if (value.size > config.maxUploadBytes) {
    throw new UploadTooLargeError(config.maxUploadMb);
  }

  return value;
}
