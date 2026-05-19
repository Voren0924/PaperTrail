import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@papertrail/db";

import type { EmbedPaperInput, EmbedPaperResult } from "../embeddings/embeddingService";
import type { RunIngestionPipelineInput, RunIngestionPipelineResult } from "../services/ingestionPipeline";

export type IngestionJob = {
  id: string;
  type: "PARSE_PAPER" | "EMBED_PAPER";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  paperId: string | null;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

export type JobRunnerRepository = {
  claimNextJob(workerId: string, now: Date): Promise<IngestionJob | null>;
  markJobSucceeded(jobId: string, message: string, now: Date): Promise<void>;
  markJobFailed(job: IngestionJob, errorMessage: string, now: Date): Promise<void>;
};

export type IngestionPipelineHandler = {
  run(input: RunIngestionPipelineInput): Promise<RunIngestionPipelineResult>;
};

export type EmbeddingJobHandler = {
  embedPaper(input: EmbedPaperInput): Promise<EmbedPaperResult>;
};

export type JobRunnerOptions = {
  workerId?: string;
  now?: () => Date;
};

export type RunNextJobResult =
  | { status: "idle" }
  | { status: "succeeded"; jobId: string }
  | { status: "failed"; jobId: string; errorMessage: string };

export function createJobRunner(
  repository: JobRunnerRepository,
  ingestionPipeline: IngestionPipelineHandler,
  embeddingService: EmbeddingJobHandler,
  options: JobRunnerOptions = {}
) {
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const now = options.now ?? (() => new Date());

  return {
    async runNext(): Promise<RunNextJobResult> {
      const job = await repository.claimNextJob(workerId, now());

      if (!job) {
        return { status: "idle" };
      }

      try {
        const paperId = getPaperIdFromJob(job);
        const message =
          job.type === "PARSE_PAPER"
            ? await runParseJob(ingestionPipeline, paperId)
            : await runEmbeddingJob(embeddingService, paperId);
        await repository.markJobSucceeded(job.id, message, now());

        return { status: "succeeded", jobId: job.id };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Ingestion job failed.";
        await repository.markJobFailed(job, errorMessage, now());

        return { status: "failed", jobId: job.id, errorMessage };
      }
    },
    workerId
  };
}

export function createPrismaJobRunnerRepository(prisma: PrismaClient): JobRunnerRepository {
  return {
    async claimNextJob(workerId, now) {
      return prisma.$transaction(async (transaction) => {
        const job = await transaction.job.findFirst({
          where: {
            type: { in: ["PARSE_PAPER", "EMBED_PAPER"] },
            status: "QUEUED",
            runAfter: { lte: now }
          },
          orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }]
        });

        if (!job) {
          return null;
        }

        const claimed = await transaction.job.updateMany({
          where: {
            id: job.id,
            status: "QUEUED"
          },
          data: {
            status: "RUNNING",
            attempts: { increment: 1 },
            lockedAt: now,
            lockedBy: workerId,
            lastHeartbeatAt: now,
            startedAt: now,
            errorMessage: null
          }
        });

        if (claimed.count !== 1) {
          return null;
        }

        const claimedJob = await transaction.job.findUniqueOrThrow({
          where: { id: job.id }
        });

        if (claimedJob.type !== "PARSE_PAPER" && claimedJob.type !== "EMBED_PAPER") {
          throw new Error(`Unsupported worker job type: ${claimedJob.type}.`);
        }

        return {
          id: claimedJob.id,
          type: claimedJob.type,
          status: "RUNNING",
          paperId: claimedJob.paperId,
          payload: claimedJob.payload,
          attempts: claimedJob.attempts,
          maxAttempts: claimedJob.maxAttempts
        };
      });
    },
    async markJobSucceeded(jobId, message, now) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "SUCCEEDED",
          errorMessage: null,
          lockedAt: null,
          lockedBy: null,
          lastHeartbeatAt: now,
          finishedAt: now,
          payload: { message }
        }
      });
    },
    async markJobFailed(job, errorMessage, now) {
      const shouldRetry = job.attempts < job.maxAttempts;

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? "QUEUED" : "FAILED",
          errorMessage,
          lockedAt: null,
          lockedBy: null,
          lastHeartbeatAt: now,
          finishedAt: shouldRetry ? null : now,
          runAfter: shouldRetry ? new Date(now.getTime() + getRetryDelayMs(job.attempts)) : now
        }
      });
    }
  };
}

async function runParseJob(ingestionPipeline: IngestionPipelineHandler, paperId: string): Promise<string> {
  const result = await ingestionPipeline.run({ paperId });

  return `Parsed ${result.pageCount} pages into ${result.chunkCount} chunks.`;
}

async function runEmbeddingJob(embeddingService: EmbeddingJobHandler, paperId: string): Promise<string> {
  const result = await embeddingService.embedPaper({ paperId });

  return `Embedded ${result.embeddedChunkCount} chunks with ${result.model}.`;
}

function getPaperIdFromJob(job: IngestionJob): string {
  if (job.paperId) {
    return job.paperId;
  }

  if (isPayloadWithPaperId(job.payload)) {
    return job.payload.paperId;
  }

  throw new Error("Ingestion job is missing paperId.");
}

function isPayloadWithPaperId(payload: unknown): payload is { paperId: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "paperId" in payload &&
    typeof payload.paperId === "string"
  );
}

function getRetryDelayMs(attempts: number): number {
  return Math.min(60_000, Math.max(1, attempts) * 5_000);
}
