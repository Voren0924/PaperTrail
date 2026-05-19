import type { PrismaClient } from "@papertrail/db";

import { CHUNK_VERSION } from "../services/chunkingService";
import {
  assertEmbeddingDimensions,
  DEFAULT_EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
  EmbeddingProviderError,
  getEmbeddingProviderConfig
} from "./embeddingProvider";
import { createOpenAiCompatibleEmbeddingProvider } from "./openAiCompatibleEmbeddingProvider";

export type EmbeddableChunk = {
  id: string;
  text: string;
  contentHash: string;
  chunkVersion: number;
  embeddingModel: string;
};

export type EmbeddingRepository = {
  findPendingPaperChunks(input: {
    paperId: string;
    model: string;
    chunkVersion: number;
    limit: number;
  }): Promise<EmbeddableChunk[]>;
  storeChunkEmbedding(input: {
    chunkId: string;
    model: string;
    embedding: number[];
  }): Promise<void>;
  markPaperEmbedding(paperId: string, message: string): Promise<void>;
  markPaperReady(paperId: string, message: string): Promise<void>;
  markPaperFailed(paperId: string, message: string): Promise<void>;
};

export type EmbedPaperInput = {
  paperId: string;
  batchSize?: number;
};

export type EmbedPaperResult = {
  paperId: string;
  embeddedChunkCount: number;
  skippedChunkCount: number;
  model: string;
};

export class EmbeddingServiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmbeddingServiceError";
  }
}

export function createEmbeddingService(repository: EmbeddingRepository, provider: EmbeddingProvider) {
  return {
    async embedPaper(input: EmbedPaperInput): Promise<EmbedPaperResult> {
      const batchSize = normalizeBatchSize(input.batchSize);
      await repository.markPaperEmbedding(input.paperId, "Embedding paper chunks.");

      try {
        let embeddedChunkCount = 0;
        let pendingChunks = await repository.findPendingPaperChunks({
          paperId: input.paperId,
          model: provider.model,
          chunkVersion: CHUNK_VERSION,
          limit: batchSize
        });

        while (pendingChunks.length > 0) {
          const providerResult = await provider.embedTexts(pendingChunks.map((chunk) => chunk.text));

          providerResult.embeddings.forEach((embedding) => {
            assertEmbeddingDimensions(embedding, provider.dimensions);
          });

          await Promise.all(
            pendingChunks.map((chunk, index) =>
              repository.storeChunkEmbedding({
                chunkId: chunk.id,
                model: provider.model,
                embedding: providerResult.embeddings[index] ?? []
              })
            )
          );

          embeddedChunkCount += pendingChunks.length;
          pendingChunks = await repository.findPendingPaperChunks({
            paperId: input.paperId,
            model: provider.model,
            chunkVersion: CHUNK_VERSION,
            limit: batchSize
          });
        }

        await repository.markPaperReady(
          input.paperId,
          embeddedChunkCount > 0
            ? `Embedded ${embeddedChunkCount} paper chunks.`
            : "Paper chunks already have current embeddings."
        );

        return {
          paperId: input.paperId,
          embeddedChunkCount,
          skippedChunkCount: 0,
          model: provider.model
        };
      } catch (error) {
        const message = getEmbeddingErrorMessage(error);
        await repository.markPaperFailed(input.paperId, message);
        throw error instanceof EmbeddingServiceError
          ? error
          : new EmbeddingServiceError(message, error instanceof Error ? { cause: error } : undefined);
      }
    }
  };
}

export function createConfiguredEmbeddingService(prisma: PrismaClient) {
  const config = getEmbeddingProviderConfig();
  const provider = createOpenAiCompatibleEmbeddingProvider(config);

  return createEmbeddingService(createPrismaEmbeddingRepository(prisma), provider);
}

export function createPrismaEmbeddingRepository(prisma: PrismaClient): EmbeddingRepository {
  return {
    async findPendingPaperChunks(input) {
      return prisma.$queryRawUnsafe<EmbeddableChunk[]>(
        `
          SELECT
            "id",
            "text",
            "contentHash",
            "chunkVersion",
            "embeddingModel"
          FROM "PaperChunk"
          WHERE
            "paperId" = $1::uuid
            AND "chunkVersion" = $2
            AND ("embedding" IS NULL OR "embeddingModel" <> $3)
          ORDER BY "chunkIndex" ASC
          LIMIT $4
        `,
        input.paperId,
        input.chunkVersion,
        input.model,
        input.limit
      );
    },
    async storeChunkEmbedding(input) {
      assertEmbeddingDimensions(input.embedding, EMBEDDING_DIMENSIONS);

      await prisma.$executeRawUnsafe(
        `
          UPDATE "PaperChunk"
          SET
            "embedding" = $1::vector,
            "embeddingModel" = $2
          WHERE "id" = $3::uuid
        `,
        vectorToSqlLiteral(input.embedding),
        input.model,
        input.chunkId
      );
    },
    async markPaperEmbedding(paperId, message) {
      await prisma.paper.update({
        where: { id: paperId },
        data: {
          status: "EMBEDDING",
          statusMessage: message
        }
      });
    },
    async markPaperReady(paperId, message) {
      await prisma.paper.update({
        where: { id: paperId },
        data: {
          status: "READY",
          statusMessage: message
        }
      });
    },
    async markPaperFailed(paperId, message) {
      await prisma.paper.update({
        where: { id: paperId },
        data: {
          status: "FAILED",
          statusMessage: message
        }
      });
    }
  };
}

export function vectorToSqlLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => formatVectorValue(value)).join(",")}]`;
}

function normalizeBatchSize(batchSize: number | undefined): number {
  if (batchSize === undefined) {
    return DEFAULT_EMBEDDING_BATCH_SIZE;
  }

  return Number.isInteger(batchSize) && batchSize > 0 ? batchSize : DEFAULT_EMBEDDING_BATCH_SIZE;
}

function getEmbeddingErrorMessage(error: unknown): string {
  if (error instanceof EmbeddingProviderError || error instanceof EmbeddingServiceError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Embedding job failed.";
}

function formatVectorValue(value: number): string {
  if (!Number.isFinite(value)) {
    throw new EmbeddingServiceError("Embedding contains a non-finite value.");
  }

  return String(value);
}
