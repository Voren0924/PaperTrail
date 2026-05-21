import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

ensureDefaultDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  papertrailPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.papertrailPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.papertrailPrisma = prisma;
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}

export type { PrismaClient };

function ensureDefaultDatabaseUrl(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  const appDataDir = process.env.PAPERTRAIL_APP_DATA_DIR || resolve(process.cwd(), ".data", "PaperTrail");
  const databasePath = resolve(appDataDir, "papertrail.db");

  mkdirSync(dirname(databasePath), { recursive: true });
  process.env.DATABASE_URL = `file:${databasePath.replace(/\\/g, "/")}`;
}
