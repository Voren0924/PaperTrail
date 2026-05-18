import { describe, expect, it } from "vitest";

import { ConflictError, UnauthenticatedError } from "@/server/errors/application-error";

import type { AuthRepository, AuthSessionRecord, AuthUserRecord } from "./repository";
import { createAuthService } from "./service";
import { hashSessionToken } from "./session-ids";

function createMemoryAuthRepository(): AuthRepository {
  const users = new Map<string, AuthUserRecord>();
  const sessions = new Map<string, AuthSessionRecord>();

  return {
    findUserByEmail(email) {
      return Promise.resolve(users.get(email) ?? null);
    },
    createUser(input) {
      const now = new Date();
      const user: AuthUserRecord = {
        id: `user-${users.size + 1}`,
        email: input.email,
        name: null,
        passwordHash: input.passwordHash,
        createdAt: now,
        updatedAt: now
      };

      users.set(user.email, user);
      return Promise.resolve(user);
    },
    createSession(input) {
      const user = [...users.values()].find((candidate) => candidate.id === input.userId);

      if (!user) {
        throw new Error("Missing user for test session.");
      }

      const session: AuthSessionRecord = {
        id: `session-${sessions.size + 1}`,
        userId: input.userId,
        sessionTokenHash: input.sessionTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        user
      };

      sessions.set(session.sessionTokenHash, session);
      return Promise.resolve(session);
    },
    findSessionByTokenHash(sessionTokenHash) {
      return Promise.resolve(sessions.get(sessionTokenHash) ?? null);
    },
    touchSession(sessionId, lastUsedAt) {
      const session = [...sessions.values()].find((candidate) => candidate.id === sessionId);

      if (session) {
        sessions.set(session.sessionTokenHash, { ...session, user: { ...session.user, updatedAt: lastUsedAt } });
      }

      return Promise.resolve();
    },
    revokeSession(sessionTokenHash, revokedAt) {
      const session = sessions.get(sessionTokenHash);

      if (session && session.expiresAt > revokedAt && !session.revokedAt) {
        sessions.set(sessionTokenHash, { ...session, revokedAt });
      }

      return Promise.resolve();
    }
  };
}

describe("auth service", () => {
  it("registers a user and stores only the session token hash", async () => {
    const repository = createMemoryAuthRepository();
    const service = createAuthService(repository);
    const result = await service.register({ email: "USER@example.com", password: "password123" });
    const session = await repository.findSessionByTokenHash(hashSessionToken(result.sessionToken));

    expect(result.user).toMatchObject({ id: "user-1", email: "user@example.com", name: null });
    expect(session?.sessionTokenHash).toEqual(hashSessionToken(result.sessionToken));
    expect(session?.sessionTokenHash).not.toEqual(result.sessionToken);
    await expect(service.getUserForSession(result.sessionToken)).resolves.toEqual(result.user);
  });

  it("rejects duplicate registrations", async () => {
    const service = createAuthService(createMemoryAuthRepository());

    await service.register({ email: "user@example.com", password: "password123" });
    await expect(service.register({ email: "USER@example.com", password: "password123" })).rejects.toThrow(
      ConflictError
    );
  });

  it("logs users in and rejects invalid credentials", async () => {
    const service = createAuthService(createMemoryAuthRepository());

    await service.register({ email: "user@example.com", password: "password123" });

    await expect(service.login({ email: "user@example.com", password: "password123" })).resolves.toMatchObject({
      user: { email: "user@example.com" }
    });
    await expect(service.login({ email: "user@example.com", password: "badpassword" })).rejects.toThrow(
      UnauthenticatedError
    );
  });

  it("revokes sessions on logout", async () => {
    const service = createAuthService(createMemoryAuthRepository());
    const result = await service.register({ email: "user@example.com", password: "password123" });

    await service.logout(result.sessionToken);

    await expect(service.getUserForSession(result.sessionToken)).resolves.toBeNull();
    await expect(service.requireUserForSession(result.sessionToken)).rejects.toThrow(UnauthenticatedError);
  });
});
