import { describe, expect, it } from "vitest";

import {
  assertEmbeddingDimensions,
  EMBEDDING_DIMENSIONS,
  EmbeddingConfigurationError,
  EmbeddingDimensionError,
  getEmbeddingProviderConfig,
  parseEmbeddingDimensions
} from "./embeddingProvider";

describe("embedding provider config", () => {
  it("builds an OpenAI-compatible provider config from environment variables", () => {
    expect(
      getEmbeddingProviderConfig({
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_BASE_URL: "https://example.test/v1",
        EMBEDDING_API_KEY: "test-key",
        EMBEDDING_MODEL: "embedding-model",
        EMBEDDING_DIMENSIONS: String(EMBEDDING_DIMENSIONS)
      })
    ).toEqual({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      credential: "test-key",
      model: "embedding-model",
      dimensions: EMBEDDING_DIMENSIONS
    });
  });

  it("rejects dimensions that do not match the local vector storage contract", () => {
    expect(() => parseEmbeddingDimensions("3072")).toThrow(EmbeddingConfigurationError);
  });

  it("validates embedding vector dimensions", () => {
    expect(() => assertEmbeddingDimensions([0.1, 0.2], EMBEDDING_DIMENSIONS)).toThrow(
      EmbeddingDimensionError
    );
  });
});
