import { createHash, randomBytes } from "node:crypto";

export const sessionTokenBytes = 32;

export function createSessionToken(): string {
  return randomBytes(sessionTokenBytes).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
