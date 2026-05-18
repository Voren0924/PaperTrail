import { PrismaClient } from "@prisma/client";

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
