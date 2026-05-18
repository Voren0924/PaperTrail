import { UnauthenticatedError } from "@/server/errors/application-error";

import { getSessionTokenFromCookies, type CookieReader } from "./cookies";
import { createPrismaAuthRepository } from "./prisma-repository";
import { createAuthService, type AuthenticatedUser } from "./service";

export async function getCurrentUser(cookieReader?: CookieReader): Promise<AuthenticatedUser | null> {
  const token = await getSessionTokenFromCookies(cookieReader);
  return createAuthService(createPrismaAuthRepository()).getUserForSession(token);
}

export async function requireCurrentUser(cookieReader?: CookieReader): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(cookieReader);

  if (!user) {
    throw new UnauthenticatedError();
  }

  return user;
}
