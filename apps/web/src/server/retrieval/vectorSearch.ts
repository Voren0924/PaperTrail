export const DEFAULT_RETRIEVAL_TOP_K = 8;
export const MAX_RETRIEVAL_TOP_K = 20;

export type VectorSearchInput = {
  paperIds: string[];
  embedding: number[];
  topK?: number;
  minSimilarity?: number;
};

export type VectorSearchCandidate = {
  paperId: string;
  chunkId: string;
  pageStart: number;
  pageEnd: number;
  sectionTitle: string | null;
  text: string;
  vectorJson: string;
};

export type VectorSearchResult = {
  paperId: string;
  chunkId: string;
  pageStart: number;
  pageEnd: number;
  sectionTitle: string | null;
  text: string;
  similarityScore: number;
};

export function searchSimilarChunks(
  candidates: VectorSearchCandidate[],
  input: VectorSearchInput
): VectorSearchResult[] {
  if (input.paperIds.length === 0) {
    return [];
  }

  const paperIds = new Set(input.paperIds);
  const topK = normalizeTopK(input.topK);

  return candidates
    .filter((candidate) => paperIds.has(candidate.paperId))
    .map((candidate) => ({
      candidate,
      similarityScore: cosineSimilarity(input.embedding, parseVectorJson(candidate.vectorJson))
    }))
    .filter((result) => Number.isFinite(result.similarityScore))
    .filter((result) => input.minSimilarity === undefined || result.similarityScore >= input.minSimilarity)
    .sort((left, right) => right.similarityScore - left.similarityScore || left.candidate.chunkId.localeCompare(right.candidate.chunkId))
    .slice(0, topK)
    .map(({ candidate, similarityScore }) => ({
      paperId: candidate.paperId,
      chunkId: candidate.chunkId,
      pageStart: candidate.pageStart,
      pageEnd: candidate.pageEnd,
      sectionTitle: candidate.sectionTitle,
      text: candidate.text,
      similarityScore
    }));
}

export function normalizeTopK(topK: number | undefined): number {
  if (topK === undefined) {
    return DEFAULT_RETRIEVAL_TOP_K;
  }

  if (!Number.isInteger(topK) || topK <= 0) {
    return DEFAULT_RETRIEVAL_TOP_K;
  }

  return Math.min(topK, MAX_RETRIEVAL_TOP_K);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return Number.NaN;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return Number.NaN;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function parseVectorJson(vectorJson: string): number[] {
  const parsed = JSON.parse(vectorJson) as unknown;

  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "number")) {
    return [];
  }

  return parsed;
}
