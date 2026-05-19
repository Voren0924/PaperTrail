import { afterEach, describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMENSIONS, type EmbeddingProviderConfig } from "./embeddingProvider";
import { createOpenAiCompatibleEmbeddingProvider } from "./openAiCompatibleEmbeddingProvider";

describe("OpenAI-compatible embedding provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts embedding requests server-side and sorts provider results by index", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "embedding-model",
          data: [
            { index: 1, embedding: createEmbedding(0.2) },
            { index: 0, embedding: createEmbedding(0.1) }
          ]
        }),
        { status: 200 }
      )
    );
    const provider = createOpenAiCompatibleEmbeddingProvider(createConfig());

    await expect(provider.embedTexts(["first", "second"])).resolves.toEqual({
      model: "embedding-model",
      embeddings: [createEmbedding(0.1), createEmbedding(0.2)]
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toEqual(new URL("https://example.test/v1/embeddings"));
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key"
    });
  });

  it("surfaces provider failures without exposing secrets", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "model unavailable" } }), { status: 400 })
    );
    const provider = createOpenAiCompatibleEmbeddingProvider(createConfig());

    await expect(provider.embedTexts(["question"])).rejects.toThrow("model unavailable");
  });
});

function createConfig(): EmbeddingProviderConfig {
  return {
    provider: "openai-compatible",
    baseUrl: "https://example.test/v1",
    credential: "test-key",
    model: "embedding-model",
    dimensions: EMBEDDING_DIMENSIONS
  };
}

function createEmbedding(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}
