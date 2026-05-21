import path from "node:path";

export function createPdfStorageKey(input: {
  paperId: string;
  originalFileName: string;
}): string {
  const extension = path.extname(input.originalFileName).toLowerCase() || ".pdf";

  return ["files", `${input.paperId}${extension}`].join("/");
}

export function sanitizeBaseName(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized || "paper";
}
