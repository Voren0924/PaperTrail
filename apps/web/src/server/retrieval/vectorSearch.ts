import { assertEmbeddingDimensions, EMBEDDING_DIMENSIONS } from "../embeddings/embeddingProvider";
import { vectorToSqlLiteral } from "../embeddings/embeddingService";

export const DEFAULT_RETRIEVAL_TOP_K = 8;
export const MAX_RETRIEVAL_TOP_K = 20;

export type VectorSearchInput = {
  userId: string;
  paperIds: string[];
  embedding: number[];
  topK?: number;
  minSimilarity?: number;
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

export type VectorSearchClient = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export async function searchSimilarChunks(
  prisma: VectorSearchClient,
  input: VectorSearchInput
): Promise<VectorSearchResult[]> {
  assertEmbeddingDimensions(input.embedding, EMBEDDING_DIMENSIONS);

  if (input.paperIds.length === 0) {
    return [];
  }

  const query = buildVectorSearchSql(input.paperIds, input.minSimilarity);
  const topK = normalizeTopK(input.topK);

  return prisma.$queryRawUnsafe<VectorSearchResult[]>(
    query,
    vectorToSqlLiteral(input.embedding),
    input.userId,
    ...input.paperIds,
    ...(input.minSimilarity === undefined ? [] : [input.minSimilarity]),
    topK
  );
}

export function buildVectorSearchSql(paperIds: string[], minSimilarity: number | undefined): string {
  if (paperIds.length === 0) {
    throw new Error("At least one paper ID is required for vector search.");
  }

  const paperPlaceholders = paperIds.map((_, index) => `$${index + 3}::uuid`).join(", ");
  const minSimilarityClause =
    minSimilarity === undefined
      ? ""
      : `AND (1 - (c."embedding" <=> $1::vector)) >= $${paperIds.length + 3}`;
  const limitPlaceholder = `$${paperIds.length + (minSimilarity === undefined ? 3 : 4)}`;

  return `
    SELECT
      c."paperId" AS "paperId",
      c."id" AS "chunkId",
      c."startPage" AS "pageStart",
      c."endPage" AS "pageEnd",
      s."title" AS "sectionTitle",
      c."text" AS "text",
      (1 - (c."embedding" <=> $1::vector))::double precision AS "similarityScore"
    FROM "PaperChunk" c
    INNER JOIN "Paper" p ON p."id" = c."paperId"
    LEFT JOIN "PaperSection" s ON s."id" = c."sectionId"
    WHERE
      p."userId" = $2::uuid
      AND c."paperId" IN (${paperPlaceholders})
      AND c."embedding" IS NOT NULL
      ${minSimilarityClause}
    ORDER BY c."embedding" <=> $1::vector ASC, c."chunkIndex" ASC
    LIMIT ${limitPlaceholder}
  `;
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
