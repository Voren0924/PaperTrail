import {
  type ChatProvider,
  type ChatProviderConfig,
  ChatProviderError
} from "./chatProvider";

type OpenAiCompatibleChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createOpenAiCompatibleChatProvider(config: ChatProviderConfig): ChatProvider {
  const endpoint = new URL("chat/completions", normalizeBaseUrl(config.baseUrl));

  return {
    name: config.provider,
    model: config.model,
    async complete(input) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.credential}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.1,
          response_format: input.responseFormat === "json" ? { type: "json_object" } : undefined
        })
      });

      const responseBody = (await response.json().catch(() => ({}))) as OpenAiCompatibleChatResponse;

      if (!response.ok) {
        throw new ChatProviderError(responseBody.error?.message ?? `Chat provider returned HTTP ${response.status}.`);
      }

      const content = responseBody.choices?.[0]?.message?.content;

      if (!content) {
        throw new ChatProviderError("Chat provider returned an empty response.");
      }

      return {
        content,
        model: responseBody.model ?? config.model,
        providerRequestId: responseBody.id ?? null
      };
    }
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
