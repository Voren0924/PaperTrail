import { describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "./embeddingProvider";
import {
  createEmbeddingService,
  type EmbeddableChunk,
  type EmbeddingRepository,
  vectorToSqlLiteral
} from "./embeddingService";

describe("embedding service", () => {
  it("embeds pending chunks and stores vectors with the provider model", async () => {
    const repository = createMemoryRepository([
      createChunk({ id: "chunk-1", text: "first chunk" }),
      createChunk({ id: "chunk-2", text: "second chunk" })
    ]);
    const { provider, embedTexts } = createProvider([createEmbedding(0.1), createEmbedding(0.2)]);
    const service = createEmbeddingService(repository, provider);

    await expect(service.embedPaper({ paperId: "paper-1", batchSize: 10 })).resolves.toMatchObject({
      embeddedChunkCount: 2,
      model: "embedding-model"
    });
    expect(embedTexts).toHaveBeenCalledWith(["first chunk", "second chunk"]);
    expect(repository.stored).toEqual([
      { chunkId: "chunk-1", model: "embedding-model", embedding: createEmbedding(0.1) },
      { chunkId: "chunk-2", model: "embedding-model", embedding: createEmbedding(0.2) }
    ]);
    expect(repository.statuses.at(-1)).toEqual({
      status: "READY",
      message: "Embedded 2 paper chunks."
    });
  });

  it("skips chunks that already have current embeddings", async () => {
    const repository = createMemoryRepository([]);
    const { provider, embedTexts } = createProvider([]);
    const service = createEmbeddingService(repository, provider);

    await expect(service.embedPaper({ paperId: "paper-1" })).resolves.toMatchObject({
      embeddedChunkCount: 0
    });
    expect(embedTexts).not.toHaveBeenCalled();
    expect(repository.statuses.at(-1)).toEqual({
      status: "READY",
      message: "Paper chunks already have current embeddings."
    });
  });

  it("marks the paper failed when the provider fails", async () => {
    const repository = createMemoryRepository([createChunk({ id: "chunk-1", text: "first chunk" })]);
    const { provider, embedTexts } = createProvider([]);
    embedTexts.mockRejectedValueOnce(new Error("provider unavailable"));
    const service = createEmbeddingService(repository, provider);

    await expect(service.embedPaper({ paperId: "paper-1" })).rejects.toThrow("provider unavailable");
    expect(repository.statuses.at(-1)).toEqual({
      status: "FAILED",
      message: "provider unavailable"
    });
  });

  it("rejects provider vectors with the wrong dimension", async () => {
    const repository = createMemoryRepository([createChunk({ id: "chunk-1", text: "first chunk" })]);
    const { provider } = createProvider([[0.1, 0.2]]);
    const service = createEmbeddingService(repository, provider);

    await expect(service.embedPaper({ paperId: "paper-1" })).rejects.toThrow("dimension mismatch");
  });

  it("formats pgvector literals without surrounding whitespace", () => {
    expect(vectorToSqlLiteral([0.1, -0.2, 3])).toBe("[0.1,-0.2,3]");
  });
});

function createMemoryRepository(chunks: EmbeddableChunk[]): EmbeddingRepository & {
  stored: Array<{ chunkId: string; model: string; embedding: number[] }>;
  statuses: Array<{ status: string; message: string }>;
} {
  const pendingChunks = [...chunks];
  const stored: Array<{ chunkId: string; model: string; embedding: number[] }> = [];
  const statuses: Array<{ status: string; message: string }> = [];

  return {
    stored,
    statuses,
    findPendingPaperChunks() {
      return Promise.resolve(pendingChunks.splice(0));
    },
    storeChunkEmbedding(input) {
      stored.push(input);
      return Promise.resolve();
    },
    markPaperEmbedding(_paperId, message) {
      statuses.push({ status: "EMBEDDING", message });
      return Promise.resolve();
    },
    markPaperReady(_paperId, message) {
      statuses.push({ status: "READY", message });
      return Promise.resolve();
    },
    markPaperFailed(_paperId, message) {
      statuses.push({ status: "FAILED", message });
      return Promise.resolve();
    }
  };
}

function createProvider(embeddings: number[][]): {
  provider: EmbeddingProvider;
  embedTexts: ReturnType<typeof vi.fn<EmbeddingProvider["embedTexts"]>>;
} {
  const embedTexts = vi.fn<EmbeddingProvider["embedTexts"]>(() =>
    Promise.resolve({ model: "embedding-model", embeddings })
  );

  return {
    provider: {
      name: "openai-compatible",
      model: "embedding-model",
      dimensions: EMBEDDING_DIMENSIONS,
      embedTexts
    },
    embedTexts
  };
}

function createChunk(input: { id: string; text: string }): EmbeddableChunk {
  return {
    id: input.id,
    text: input.text,
    contentHash: `${input.id}-hash`,
    chunkVersion: 1,
    embeddingModel: "pending"
  };
}

function createEmbedding(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}
