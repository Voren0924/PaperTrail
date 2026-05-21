import { jsonResponse, withApiErrors } from "@/server/http/api-response";
import {
  createChatProviderConfigFromSettings,
  createEmbeddingProviderConfigFromSettings,
  createSettingsService
} from "@/server/settings/settingsService";
import { createOpenAiCompatibleChatProvider } from "@/server/chat/openAiCompatibleChatProvider";
import { createOpenAiCompatibleEmbeddingProvider } from "@/server/embeddings/openAiCompatibleEmbeddingProvider";

export async function POST() {
  return withApiErrors(async () => {
    const settings = await createSettingsService().requireProviderSettings();
    const embeddingProvider = createOpenAiCompatibleEmbeddingProvider(
      createEmbeddingProviderConfigFromSettings(settings)
    );
    const chatProvider = createOpenAiCompatibleChatProvider(createChatProviderConfigFromSettings(settings));

    await embeddingProvider.embedTexts(["PaperTrail connection test"]);
    await chatProvider.complete({
      messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }],
      responseFormat: "json",
      temperature: 0
    });

    return jsonResponse({ ok: true });
  });
}
