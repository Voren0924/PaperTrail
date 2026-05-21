import { describe, expect, it } from "vitest";

import { cosineSimilarity, normalizeTopK, searchSimilarChunks } from "./vectorSearch";

describe("vector search", () => {
  it("sorts local SQLite embedding candidates by cosine similarity", () => {
    expect(
      searchSimilarChunks(
        [
          createCandidate({ chunkId: "chunk-low", vector: [0.2, 0.8] }),
          createCandidate({ chunkId: "chunk-high", vector: [1, 0] }),
          createCandidate({ chunkId: "chunk-other-paper", paperId: "paper-2", vector: [1, 0] })
        ],
        {
          paperIds: ["paper-1"],
          embedding: [1, 0],
          topK: 1
        }
      )
    ).toEqual([
      {
        paperId: "paper-1",
        chunkId: "chunk-high",
        pageStart: 1,
        pageEnd: 1,
        sectionTitle: null,
        text: "Candidate text",
        similarityScore: 1
      }
    ]);
  });

  it("applies a minimum similarity threshold", () => {
    const results = searchSimilarChunks([createCandidate({ chunkId: "chunk-1", vector: [0, 1] })], {
      paperIds: ["paper-1"],
      embedding: [1, 0],
      minSimilarity: 0.5
    });

    expect(results).toEqual([]);
  });

  it("normalizes topK to a safe bounded value", () => {
    expect(normalizeTopK(undefined)).toBe(8);
    expect(normalizeTopK(0)).toBe(8);
    expect(normalizeTopK(50)).toBe(20);
    expect(normalizeTopK(3)).toBe(3);
  });

  it("returns NaN for dimension mismatches", () => {
    expect(cosineSimilarity([1, 0], [1])).toBeNaN();
  });
});

function createCandidate(input: { chunkId: string; paperId?: string; vector: number[] }) {
  return {
    paperId: input.paperId ?? "paper-1",
    chunkId: input.chunkId,
    pageStart: 1,
    pageEnd: 1,
    sectionTitle: null,
    text: "Candidate text",
    vectorJson: JSON.stringify(input.vector)
  };
}
