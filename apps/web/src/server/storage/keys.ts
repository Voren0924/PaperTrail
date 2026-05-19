import { randomUUID } from "node:crypto";
import path from "node:path";

export function createPdfStorageKey(input: {
  userId: string;
  originalFileName: string;
  fileSha256: string;
}): string {
  const extension = path.extname(input.originalFileName).toLowerCase() || ".pdf";
  const safeBaseName = sanitizeBaseName(path.basename(input.originalFileName, extension));
  const hashPrefix = input.fileSha256.slice(0, 16);

  return [
    "papers",
    input.userId,
    `${new Date().toISOString().slice(0, 10)}`,
    `${safeBaseName}-${hashPrefix}-${randomUUID()}${extension}`
  ].join("/");
}

export function sanitizeBaseName(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized || "paper";
}
