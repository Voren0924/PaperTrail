import { requireCurrentUser } from "@/server/auth/current-user";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";

export async function GET() {
  return withApiErrors(async () => {
    const user = await requireCurrentUser();

    return jsonResponse({ user });
  });
}
