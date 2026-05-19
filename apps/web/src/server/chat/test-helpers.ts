import type { RetrievedChunk } from "../retrieval/retrievalService";

export function createRetrievedChunk(input: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    paperId: input.paperId ?? "paper-1",
    chunkId: input.chunkId ?? "chunk-1",
    pageStart: input.pageStart ?? 1,
    pageEnd: input.pageEnd ?? 1,
    sectionTitle: input.sectionTitle ?? "Introduction",
    text: input.text ?? "This chunk contains relevant paper evidence.",
    similarityScore: input.similarityScore ?? 0.9
  };
}
