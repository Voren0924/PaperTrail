import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import { createSettingsService } from "@/server/settings/settingsService";
import { readJsonObject } from "@/server/validation/request";

export async function GET() {
  return withApiErrors(async () => {
    const settings = await createSettingsService().getPublicSettings();

    return jsonResponse({ settings });
  });
}

export async function PUT(request: Request) {
  return withApiErrors(async () => {
    const body = await readJsonObject(request);
    const settings = await createSettingsService().saveProviderSettings({
      providerBaseUrl: readOptionalString(body.providerBaseUrl),
      "providerApiKey": readOptionalString(body.providerApiKey),
      chatModel: readOptionalString(body.chatModel),
      embeddingModel: readOptionalString(body.embeddingModel),
      maxRetrievedChunks: readOptionalSetting(body.maxRetrievedChunks),
      temperature: readOptionalSetting(body.temperature)
    });

    return jsonResponse({ settings });
  });
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalSetting(value: unknown): string | number | null | undefined {
  if (typeof value === "string" || typeof value === "number" || value === null) {
    return value;
  }

  return undefined;
}
