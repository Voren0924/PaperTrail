import { clearSessionCookie, getSessionTokenFromCookies } from "@/server/auth/cookies";
import { createPrismaAuthRepository } from "@/server/auth/prisma-repository";
import { createAuthService } from "@/server/auth/service";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";

export async function POST() {
  return withApiErrors(async () => {
    const sessionToken = await getSessionTokenFromCookies();
    await createAuthService(createPrismaAuthRepository()).logout(sessionToken);

    const response = jsonResponse({ ok: true });
    clearSessionCookie(response);

    return response;
  });
}
