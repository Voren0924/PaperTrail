import { requireCurrentUser } from "@/server/auth/current-user";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { createPaperService } from "@/server/papers/service";

type PaperRetryRouteContext = {
  params: Promise<{
    paperId: string;
  }>;
};

export async function POST(_request: Request, context: PaperRetryRouteContext) {
  return withApiErrors(async () => {
    const currentUser = await requireCurrentUser();
    const { paperId } = await context.params;
    const result = await createPaperService().retryPaper({
      currentUserId: currentUser.id,
      paperId
    });

    return jsonResponse(result, { status: 202 });
  });
}
