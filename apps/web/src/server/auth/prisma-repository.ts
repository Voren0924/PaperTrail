import type { PrismaClient } from "@papertrail/db";
import { getPrismaClient } from "@papertrail/db";

import type { AuthRepository } from "./repository";

export function createPrismaAuthRepository(
  prisma: PrismaClient = getPrismaClient()
): AuthRepository {
  return {
    findUserByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },
    createUser(input) {
      return prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash
        }
      });
    },
    createSession(input) {
      return prisma.session.create({
        data: input,
        include: { user: true }
      });
    },
    findSessionByTokenHash(sessionTokenHash) {
      return prisma.session.findUnique({
        where: { sessionTokenHash },
        include: { user: true }
      });
    },
    async touchSession(sessionId, lastUsedAt) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { lastUsedAt }
      });
    },
    async revokeSession(sessionTokenHash, revokedAt) {
      await prisma.session.updateMany({
        where: {
          sessionTokenHash,
          revokedAt: null,
          expiresAt: { gt: revokedAt }
        },
        data: { revokedAt }
      });
    }
  };
}
