import { requireCurrentUser } from "@/server/auth/current-user";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { createPaperService } from "@/server/papers/service";

type PaperRouteContext = {
  params: Promise<{
    paperId: string;
  }>;
};

export async function GET(_request: Request, context: PaperRouteContext) {
  return withApiErrors(async () => {
    const currentUser = await requireCurrentUser();
    const { paperId } = await context.params;
    const result = await createPaperService().getPaper({
      currentUserId: currentUser.id,
      paperId
    });

    return jsonResponse(result);
  });
}

export async function DELETE(_request: Request, context: PaperRouteContext) {
  return withApiErrors(async () => {
    const currentUser = await requireCurrentUser();
    const { paperId } = await context.params;
    const result = await createPaperService().deletePaper({
      currentUserId: currentUser.id,
      paperId
    });

    return jsonResponse(result);
  });
}
