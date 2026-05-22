import { pathToFileURL } from "node:url";

import { getPrismaClient } from "@papertrail/db";

import {
  createConfiguredEmbeddingService,
  type EmbedPaperInput
} from "../embeddings/embeddingService";
import {
  createIngestionPipeline,
  createLocalPdfStorageReader,
  createPrismaIngestionRepository
} from "../services/ingestionPipeline";
import { createJobRunner, createPrismaJobRunnerRepository } from "./jobRunner";
import type { RunNextJobResult } from "./jobRunner";

export type WorkerOptions = {
  pollIntervalMs?: number;
  stopSignal?: AbortSignal;
  logger?: WorkerLogger;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export type WorkerLogger = {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

export type WorkerLoopOptions = {
  runNext(): Promise<RunNextJobResult>;
  pollIntervalMs: number;
  stopSignal?: AbortSignal;
  logger?: WorkerLogger;
  sleepFn?: (durationMs: number, signal?: AbortSignal) => Promise<void>;
};

export async function startWorker(options: WorkerOptions = {}): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? getWorkerPollIntervalMs();
  const logger = options.logger ?? console;
  const prisma = getPrismaClient();
  const pipeline = createIngestionPipeline(
    createPrismaIngestionRepository(prisma),
    createLocalPdfStorageReader(),
    logger
  );
  const embeddingService = {
    embedPaper(input: EmbedPaperInput) {
      return createConfiguredEmbeddingService(prisma, logger).embedPaper(input);
    }
  };
  const jobRunner = createJobRunner(
    createPrismaJobRunnerRepository(prisma),
    pipeline,
    embeddingService
  );

  logger.info("worker started", {
    databaseUrlTarget: getSafeDatabaseUrlTarget(process.env.DATABASE_URL),
    pollIntervalMs,
    workerId: jobRunner.workerId
  });

  await runWorkerLoop({
    runNext: () => jobRunner.runNext(),
    pollIntervalMs,
    stopSignal: options.stopSignal,
    logger
  });
}

export async function runWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const logger = options.logger ?? console;
  const sleepFor = options.sleepFn ?? sleep;
  let cycle = 0;

  while (!options.stopSignal?.aborted) {
    cycle += 1;

    try {
      const result = await options.runNext();
      logPollingCycle(logger, cycle, result);

      if (result.status === "idle") {
        await sleepFor(options.pollIntervalMs, options.stopSignal);
      }
    } catch (error) {
      logger.error("worker polling cycle failed", {
        cycle,
        errorMessage: getErrorMessage(error)
      });
      await sleepFor(options.pollIntervalMs, options.stopSignal);
    }
  }

  logger.info("worker stopped", { cycles: cycle });
}

function getWorkerPollIntervalMs(): number {
  const rawValue = process.env.WORKER_POLL_INTERVAL_MS;
  const parsed = rawValue ? Number(rawValue) : DEFAULT_POLL_INTERVAL_MS;

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_POLL_INTERVAL_MS;
}

function sleep(durationMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, durationMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}

async function main(): Promise<void> {
  const abortController = new AbortController();
  const stop = (signal: NodeJS.Signals) => {
    console.info("worker shutdown requested", { signal });
    abortController.abort();
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await startWorker({ stopSignal: abortController.signal });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

function logPollingCycle(
  logger: WorkerLogger,
  cycle: number,
  result: RunNextJobResult
): void {
  if (result.status === "idle") {
    logger.info("worker polling cycle", {
      cycle,
      status: "idle",
      processedJobs: 0
    });
    return;
  }

  if (result.status === "failed") {
    logger.info("worker polling cycle", {
      cycle,
      status: "failed",
      processedJobs: 1,
      jobId: result.jobId,
      jobType: result.jobType,
      documentId: result.paperId,
      errorMessage: result.errorMessage
    });
    return;
  }

  logger.info("worker polling cycle", {
    cycle,
    status: "succeeded",
    processedJobs: 1,
    jobId: result.jobId,
    jobType: result.jobType,
    documentId: result.paperId,
    message: result.message,
    ...result.metrics
  });
}

function getSafeDatabaseUrlTarget(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    return "unset";
  }

  if (databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  try {
    const parsed = new URL(databaseUrl);
    parsed.username = parsed.username ? "<redacted>" : "";
    parsed.password = parsed.password ? "<redacted>" : "";

    return parsed.toString();
  } catch {
    return "<unparseable>";
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown worker error.";
}
