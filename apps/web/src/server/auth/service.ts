import { ConflictError, UnauthenticatedError } from "@/server/errors/application-error";

import { getSessionExpiresAt } from "./cookies";
import { hashPassword, verifyPassword } from "./passwords";
import type { AuthRepository } from "./repository";
import { createSessionToken, hashSessionToken } from "./session-ids";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthResult = {
  user: AuthenticatedUser;
  sessionToken: string;
  expiresAt: Date;
};

export type AuthService = {
  register(input: { email: string; "password": string }): Promise<AuthResult>;
  login(input: { email: string; "password": string }): Promise<AuthResult>;
  logout(sessionToken: string | null): Promise<void>;
  getUserForSession(sessionToken: string | null): Promise<AuthenticatedUser | null>;
  requireUserForSession(sessionToken: string | null): Promise<AuthenticatedUser>;
};

export function createAuthService(repository: AuthRepository): AuthService {
  const service: AuthService = {
    async register(input) {
      const email = normalizeEmail(input.email);
      const existingUser = await repository.findUserByEmail(email);

      if (existingUser) {
        throw new ConflictError("An account already exists for this email.", { email });
      }

      const passwordHash = await hashPassword(input.password);
      const user = await createUniqueUser(repository, { email, passwordHash });

      return createSessionForUser(repository, toAuthenticatedUser(user));
    },

    async login(input) {
      const email = normalizeEmail(input.email);
      const user = await repository.findUserByEmail(email);

      if (!user?.passwordHash) {
        throw invalidCredentialsError();
      }

      const isPasswordValid = await verifyPassword(input.password, user.passwordHash);

      if (!isPasswordValid) {
        throw invalidCredentialsError();
      }

      return createSessionForUser(repository, toAuthenticatedUser(user));
    },

    async logout(sessionToken) {
      if (!sessionToken) {
        return;
      }

      await repository.revokeSession(hashSessionToken(sessionToken), new Date());
    },

    async getUserForSession(sessionToken) {
      if (!sessionToken) {
        return null;
      }

      const session = await repository.findSessionByTokenHash(hashSessionToken(sessionToken));
      const now = new Date();

      if (!session || session.revokedAt || session.expiresAt <= now) {
        return null;
      }

      await repository.touchSession(session.id, now);
      return toAuthenticatedUser(session.user);
    },

    async requireUserForSession(sessionToken) {
      const user = await service.getUserForSession(sessionToken);

      if (!user) {
        throw new UnauthenticatedError();
      }

      return user;
    }
  };

  return service;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function createSessionForUser(
  repository: AuthRepository,
  user: AuthenticatedUser
): Promise<AuthResult> {
  const sessionToken = createSessionToken();
  const expiresAt = getSessionExpiresAt();

  await repository.createSession({
    userId: user.id,
    sessionTokenHash: hashSessionToken(sessionToken),
    expiresAt
  });

  return { user, sessionToken, expiresAt };
}

function toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}

function invalidCredentialsError(): UnauthenticatedError {
  return new UnauthenticatedError("Email or password is incorrect.");
}

async function createUniqueUser(
  repository: AuthRepository,
  input: { email: string; passwordHash: string }
): Promise<AuthenticatedUser> {
  try {
    return await repository.createUser(input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("An account already exists for this email.", { email: input.email });
    }

    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
