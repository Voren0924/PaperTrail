import type { PrismaClient } from "@papertrail/db";

import type { EmbeddingProvider } from "../embeddings/embeddingProvider";
import { getEmbeddingProviderConfig } from "../embeddings/embeddingProvider";
import { createOpenAiCompatibleEmbeddingProvider } from "../embeddings/openAiCompatibleEmbeddingProvider";
import {
  DEFAULT_RETRIEVAL_TOP_K,
  normalizeTopK,
  searchSimilarChunks,
  type VectorSearchResult
} from "./vectorSearch";

export type RetrievalRepository = {
  listAccessiblePaperIds(input: {
    userId: string;
    paperIds: string[];
  }): Promise<string[]>;
  searchSimilarChunks(input: {
    userId: string;
    paperIds: string[];
    embedding: number[];
    topK: number;
    minSimilarity?: number;
  }): Promise<VectorSearchResult[]>;
};

export type RetrieveRelevantChunksInput = {
  userId: string;
  query: string;
  paperIds: string[];
  topK?: number;
  minSimilarity?: number;
};

export type RetrievedChunk = VectorSearchResult;

export type RetrievalResult = {
  query: string;
  paperIds: string[];
  embeddingModel: string;
  topK: number;
  chunks: RetrievedChunk[];
};

export class RetrievalServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalServiceError";
  }
}

export function createRetrievalService(repository: RetrievalRepository, embeddingProvider: EmbeddingProvider) {
  return {
    async retrieve(input: RetrieveRelevantChunksInput): Promise<RetrievalResult> {
      const query = input.query.trim();

      if (!query) {
        throw new RetrievalServiceError("Retrieval query is required.");
      }

      if (input.paperIds.length === 0) {
        throw new RetrievalServiceError("At least one paper ID is required for retrieval.");
      }

      const accessiblePaperIds = await repository.listAccessiblePaperIds({
        userId: input.userId,
        paperIds: input.paperIds
      });

      if (accessiblePaperIds.length !== input.paperIds.length) {
        throw new RetrievalServiceError("One or more papers are not accessible to the current user.");
      }

      const embeddingResult = await embeddingProvider.embedTexts([query]);
      const queryEmbedding = embeddingResult.embeddings[0];

      if (!queryEmbedding) {
        throw new RetrievalServiceError("Embedding provider did not return a query embedding.");
      }

      const topK = normalizeTopK(input.topK ?? DEFAULT_RETRIEVAL_TOP_K);
      const chunks = await repository.searchSimilarChunks({
        userId: input.userId,
        paperIds: accessiblePaperIds,
        embedding: queryEmbedding,
        topK,
        minSimilarity: input.minSimilarity
      });

      return {
        query,
        paperIds: accessiblePaperIds,
        embeddingModel: embeddingResult.model,
        topK,
        chunks
      };
    }
  };
}

export function createConfiguredRetrievalService(prisma: PrismaClient) {
  const config = getEmbeddingProviderConfig();
  const provider = createOpenAiCompatibleEmbeddingProvider(config);

  return createRetrievalService(createPrismaRetrievalRepository(prisma), provider);
}

export function createPrismaRetrievalRepository(prisma: PrismaClient): RetrievalRepository {
  return {
    async listAccessiblePaperIds(input) {
      const papers = await prisma.paper.findMany({
        where: {
          userId: input.userId,
          id: { in: input.paperIds }
        },
        select: { id: true }
      });

      const accessible = new Set(papers.map((paper) => paper.id));

      return input.paperIds.filter((paperId) => accessible.has(paperId));
    },
    searchSimilarChunks(input) {
      return searchSimilarChunks(prisma, input);
    }
  };
}
