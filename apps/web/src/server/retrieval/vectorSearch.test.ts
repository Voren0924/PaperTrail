import { describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMENSIONS } from "../embeddings/embeddingProvider";
import { buildVectorSearchSql, normalizeTopK, searchSimilarChunks } from "./vectorSearch";

describe("vector search", () => {
  it("constructs scoped pgvector SQL with user and paper filters", () => {
    const sql = buildVectorSearchSql(["paper-1", "paper-2"], 0.75);

    expect(sql).toContain('p."userId" = $2::uuid');
    expect(sql).toContain('c."paperId" IN ($3::uuid, $4::uuid)');
    expect(sql).toContain('(1 - (c."embedding" <=> $1::vector)) >= $5');
    expect(sql).toContain("LIMIT $6");
    expect(sql).toContain('ORDER BY c."embedding" <=> $1::vector ASC, c."chunkIndex" ASC');
  });

  it("passes vector search parameters in deterministic order", async () => {
    const queryRawUnsafe = vi.fn((_query: string, ..._values: unknown[]) => Promise.resolve([]));
    const prisma = {
      $queryRawUnsafe: <T>(query: string, ...values: unknown[]) =>
        queryRawUnsafe(query, ...values) as Promise<T>
    };

    await searchSimilarChunks(prisma, {
      userId: "user-1",
      paperIds: ["paper-1"],
      embedding: createEmbedding(0.1),
      topK: 5
    });

    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('p."userId" = $2::uuid'),
      expect.stringMatching(/^\[/),
      "user-1",
      "paper-1",
      5
    );
  });

  it("normalizes topK to a safe bounded value", () => {
    expect(normalizeTopK(undefined)).toBe(8);
    expect(normalizeTopK(0)).toBe(8);
    expect(normalizeTopK(50)).toBe(20);
    expect(normalizeTopK(3)).toBe(3);
  });
});

function createEmbedding(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}
