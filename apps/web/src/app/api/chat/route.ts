import { createChatService } from "@/server/chat/chatService";
import { validateChatRequest } from "@/server/chat/validation";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { LOCAL_USER_ID } from "@/server/local/localUser";
import { readJsonObject } from "@/server/validation/request";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const body = await readJsonObject(request);
    const input = validateChatRequest(body);
    const result = await createChatService().answerQuestion({
      currentUserId: LOCAL_USER_ID,
      ...input
    });

    return jsonResponse(result);
  });
}
