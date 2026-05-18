import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { setSessionCookie } from "@/server/auth/cookies";
import { createPrismaAuthRepository } from "@/server/auth/prisma-repository";
import { createAuthService } from "@/server/auth/service";
import { readJsonObject, validateAuthCredentials } from "@/server/validation/request";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const body = await readJsonObject(request);
    const input = validateAuthCredentials(body);
    const result = await createAuthService(createPrismaAuthRepository()).register(input);
    const response = jsonResponse({ user: result.user }, { status: 201 });

    setSessionCookie(response, result.sessionToken, result.expiresAt);

    return response;
  });
}
