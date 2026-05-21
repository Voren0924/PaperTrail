import { describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "../embeddings/embeddingProvider";
import { createRetrievalService, type RetrievalRepository } from "./retrievalService";

describe("retrieval service", () => {
  it("embeds the query, enforces paper ownership, and returns citation metadata", async () => {
    const repository = createRepository({
      accessiblePaperIds: ["paper-1"],
      chunks: [
        {
          paperId: "paper-1",
          chunkId: "chunk-1",
          pageStart: 2,
          pageEnd: 3,
          sectionTitle: "Method",
          text: "Relevant method details.",
          similarityScore: 0.91
        }
      ]
    });
    const provider = createProvider(createEmbedding(0.3));
    const service = createRetrievalService(repository, provider);

    await expect(
      service.retrieve({
        userId: "user-1",
        query: "What is the method?",
        paperIds: ["paper-1"],
        topK: 4
      })
    ).resolves.toEqual({
      query: "What is the method?",
      paperIds: ["paper-1"],
      embeddingModel: "embedding-model",
      topK: 4,
      chunks: [
        {
          paperId: "paper-1",
          chunkId: "chunk-1",
          pageStart: 2,
          pageEnd: 3,
          sectionTitle: "Method",
          text: "Relevant method details.",
          similarityScore: 0.91
        }
      ]
    });
    expect(repository.searches).toEqual([
      {
        userId: "user-1",
        paperIds: ["paper-1"],
        provider: "openai-compatible",
        model: "embedding-model",
        embedding: createEmbedding(0.3),
        topK: 4,
        minSimilarity: undefined
      }
    ]);
  });

  it("rejects retrieval when a requested paper is not owned by the user", async () => {
    const repository = createRepository({ accessiblePaperIds: ["paper-1"], chunks: [] });
    const service = createRetrievalService(repository, createProvider(createEmbedding(0.3)));

    await expect(
      service.retrieve({
        userId: "user-1",
        query: "question",
        paperIds: ["paper-1", "paper-2"]
      })
    ).rejects.toThrow("not accessible");
  });
});

function createRepository(input: {
  accessiblePaperIds: string[];
  chunks: Awaited<ReturnType<RetrievalRepository["searchSimilarChunks"]>>;
}): RetrievalRepository & {
  searches: Array<Parameters<RetrievalRepository["searchSimilarChunks"]>[0]>;
} {
  const searches: Array<Parameters<RetrievalRepository["searchSimilarChunks"]>[0]> = [];

  return {
    searches,
    listAccessiblePaperIds() {
      return Promise.resolve(input.accessiblePaperIds);
    },
    searchSimilarChunks(searchInput) {
      searches.push(searchInput);
      return Promise.resolve(input.chunks);
    }
  };
}

function createProvider(embedding: number[]): EmbeddingProvider {
  return {
    name: "openai-compatible",
    model: "embedding-model",
    dimensions: EMBEDDING_DIMENSIONS,
    embedTexts: vi.fn(() => Promise.resolve({ model: "embedding-model", embeddings: [embedding] }))
  };
}

function createEmbedding(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}
