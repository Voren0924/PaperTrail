import type { PrismaClient } from "@papertrail/db";

import {
  createEmbeddingProviderConfigFromSettings,
  createSettingsService
} from "@/server/settings/settingsService";

import { CHUNK_VERSION } from "../services/chunkingService";
import {
  assertEmbeddingDimensions,
  DEFAULT_EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
  EmbeddingProviderError
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
    provider: string;
    paperId: string;
    model: string;
    chunkVersion: number;
    limit: number;
  }): Promise<EmbeddableChunk[]>;
  storeChunkEmbedding(input: {
    chunkId: string;
    provider: string;
    model: string;
    embedding: number[];
  }): Promise<void>;
  markPaperEmbedding(paperId: string, message: string): Promise<void>;
  markPaperReady(paperId: string, message: string): Promise<void>;
  markPaperFailed(paperId: string, message: string): Promise<void>;
};

export type EmbeddingLogger = {
  info(message: string, metadata?: Record<string, unknown>): void;
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

export function createEmbeddingService(
  repository: EmbeddingRepository,
  provider: EmbeddingProvider,
  logger: EmbeddingLogger = console
) {
  return {
    async embedPaper(input: EmbedPaperInput): Promise<EmbedPaperResult> {
      const batchSize = normalizeBatchSize(input.batchSize);
      await repository.markPaperEmbedding(
        input.paperId,
        "Embedding paper chunks."
      );
      logger.info("worker document embedding started", {
        documentId: input.paperId,
        statusTransition: "EMBEDDING -> EMBEDDING",
        embeddingModel: provider.model
      });

      try {
        let embeddedChunkCount = 0;
        let pendingChunks = await repository.findPendingPaperChunks({
          paperId: input.paperId,
          provider: provider.name,
          model: provider.model,
          chunkVersion: CHUNK_VERSION,
          limit: batchSize
        });

        while (pendingChunks.length > 0) {
          const providerResult = await provider.embedTexts(
            pendingChunks.map((chunk) => chunk.text)
          );

          providerResult.embeddings.forEach((embedding) => {
            assertEmbeddingDimensions(embedding, provider.dimensions);
          });

          await Promise.all(
            pendingChunks.map((chunk, index) =>
              repository.storeChunkEmbedding({
                chunkId: chunk.id,
                provider: provider.name,
                model: provider.model,
                embedding: providerResult.embeddings[index] ?? []
              })
            )
          );

          embeddedChunkCount += pendingChunks.length;
          pendingChunks = await repository.findPendingPaperChunks({
            paperId: input.paperId,
            provider: provider.name,
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
        logger.info("worker document embedded", {
          documentId: input.paperId,
          statusTransition: "EMBEDDING -> READY",
          embeddingCount: embeddedChunkCount,
          skippedEmbeddingCount: 0,
          embeddingModel: provider.model
        });

        return {
          paperId: input.paperId,
          embeddedChunkCount,
          skippedChunkCount: 0,
          model: provider.model
        };
      } catch (error) {
        const message = getEmbeddingErrorMessage(error);
        await repository.markPaperFailed(input.paperId, message);
        logger.info("worker document embedding failed", {
          documentId: input.paperId,
          statusTransition: "EMBEDDING -> FAILED",
          embeddingCount: 0,
          embeddingModel: provider.model,
          errorMessage: message
        });
        throw error instanceof EmbeddingServiceError
          ? error
          : new EmbeddingServiceError(
              message,
              error instanceof Error ? { cause: error } : undefined
            );
      }
    }
  };
}

export function createConfiguredEmbeddingService(
  prisma: PrismaClient,
  logger?: EmbeddingLogger
) {
  const repository = createPrismaEmbeddingRepository(prisma);
  const settingsService = createSettingsService();

  return {
    async embedPaper(input: EmbedPaperInput): Promise<EmbedPaperResult> {
      const settings = await settingsService.requireProviderSettings();
      const provider = createOpenAiCompatibleEmbeddingProvider(
        createEmbeddingProviderConfigFromSettings(settings)
      );

      return createEmbeddingService(repository, provider, logger).embedPaper(
        input
      );
    }
  };
}

export function createPrismaEmbeddingRepository(
  prisma: PrismaClient
): EmbeddingRepository {
  return {
    async findPendingPaperChunks(input) {
      return prisma.paperChunk.findMany({
        where: {
          paperId: input.paperId,
          chunkVersion: input.chunkVersion,
          embeddings: {
            none: {
              provider: input.provider,
              model: input.model
            }
          }
        },
        orderBy: { chunkIndex: "asc" },
        take: input.limit,
        select: {
          id: true,
          text: true,
          contentHash: true,
          chunkVersion: true,
          embeddingModel: true
        }
      });
    },
    async storeChunkEmbedding(input) {
      assertEmbeddingDimensions(input.embedding, EMBEDDING_DIMENSIONS);

      await prisma.embedding.upsert({
        where: {
          chunkId_provider_model: {
            chunkId: input.chunkId,
            provider: input.provider,
            model: input.model
          }
        },
        update: {
          dimensions: input.embedding.length,
          vectorJson: vectorToJson(input.embedding)
        },
        create: {
          chunkId: input.chunkId,
          provider: input.provider,
          model: input.model,
          dimensions: input.embedding.length,
          vectorJson: vectorToJson(input.embedding)
        }
      });
      await prisma.paperChunk.update({
        where: { id: input.chunkId },
        data: { embeddingModel: input.model }
      });
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

export function vectorToJson(embedding: number[]): string {
  return `[${embedding.map((value) => formatVectorValue(value)).join(",")}]`;
}

function normalizeBatchSize(batchSize: number | undefined): number {
  if (batchSize === undefined) {
    return DEFAULT_EMBEDDING_BATCH_SIZE;
  }

  return Number.isInteger(batchSize) && batchSize > 0
    ? batchSize
    : DEFAULT_EMBEDDING_BATCH_SIZE;
}

function getEmbeddingErrorMessage(error: unknown): string {
  if (
    error instanceof EmbeddingProviderError ||
    error instanceof EmbeddingServiceError
  ) {
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
