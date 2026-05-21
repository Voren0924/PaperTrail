import { BadRequestError } from "@/server/errors/application-error";
import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { createPaperService } from "@/server/papers/service";

export async function GET() {
  return withApiErrors(async () => {
    const result = await createPaperService().listPapers();

    return jsonResponse(result);
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const formData = await readUploadFormData(request);
    const result = await createPaperService().uploadPaper({
      file: formData.get("file")
    });

    return jsonResponse(result, { status: 201 });
  });
}

async function readUploadFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new BadRequestError("Request body must be multipart form data.");
  }
}
