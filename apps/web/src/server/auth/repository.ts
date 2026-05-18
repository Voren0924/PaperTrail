export type AuthUserRecord = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthSessionRecord = {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUserRecord;
};

export type AuthRepository = {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUser(input: { email: string; passwordHash: string }): Promise<AuthUserRecord>;
  createSession(input: {
    userId: string;
    sessionTokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSessionRecord>;
  findSessionByTokenHash(sessionTokenHash: string): Promise<AuthSessionRecord | null>;
  touchSession(sessionId: string, lastUsedAt: Date): Promise<void>;
  revokeSession(sessionTokenHash: string, revokedAt: Date): Promise<void>;
};
