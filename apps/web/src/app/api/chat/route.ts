import { requireCurrentUser } from "@/server/auth/current-user";
import { createChatService } from "@/server/chat/chatService";
import { validateChatRequest } from "@/server/chat/validation";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { readJsonObject } from "@/server/validation/request";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const currentUser = await requireCurrentUser();
    const body = await readJsonObject(request);
    const input = validateChatRequest(body);
    const result = await createChatService().answerQuestion({
      currentUserId: currentUser.id,
      ...input
    });

    return jsonResponse(result);
  });
}
