import {
  assertEmbeddingDimensions,
  type EmbeddingProvider,
  type EmbeddingProviderConfig,
  EmbeddingProviderError
} from "./embeddingProvider";

type OpenAiEmbeddingResponse = {
  data?: Array<{
    index?: number;
    embedding?: unknown;
  }>;
  model?: string;
  error?: {
    message?: string;
  };
};

export function createOpenAiCompatibleEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
  const endpoint = new URL("embeddings", normalizeBaseUrl(config.baseUrl));

  return {
    name: config.provider,
    model: config.model,
    dimensions: config.dimensions,
    async embedTexts(texts) {
      if (texts.length === 0) {
        return { model: config.model, embeddings: [] };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.credential}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
          dimensions: config.dimensions
        })
      });

      const responseBody = (await response.json().catch(() => ({}))) as OpenAiEmbeddingResponse;

      if (!response.ok) {
        throw new EmbeddingProviderError(
          responseBody.error?.message ?? `Embedding provider returned HTTP ${response.status}.`
        );
      }

      const embeddings = normalizeEmbeddingResponse(responseBody, texts.length, config.dimensions);

      return {
        model: responseBody.model ?? config.model,
        embeddings
      };
    }
  };
}

function normalizeEmbeddingResponse(
  responseBody: OpenAiEmbeddingResponse,
  expectedCount: number,
  expectedDimensions: number
): number[][] {
  if (!Array.isArray(responseBody.data) || responseBody.data.length !== expectedCount) {
    throw new EmbeddingProviderError("Embedding provider returned an unexpected number of embeddings.");
  }

  return [...responseBody.data]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding) || !item.embedding.every((value) => typeof value === "number")) {
        throw new EmbeddingProviderError("Embedding provider returned an invalid embedding payload.");
      }

      assertEmbeddingDimensions(item.embedding, expectedDimensions);

      return item.embedding;
    });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
