import { pathToFileURL } from "node:url";

import { getPrismaClient } from "@papertrail/db";

import { createConfiguredEmbeddingService, type EmbedPaperInput } from "../embeddings/embeddingService";
import {
  createIngestionPipeline,
  createLocalPdfStorageReader,
  createPrismaIngestionRepository
} from "../services/ingestionPipeline";
import { createJobRunner, createPrismaJobRunnerRepository } from "./jobRunner";

export type WorkerOptions = {
  pollIntervalMs?: number;
  stopSignal?: AbortSignal;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export async function startWorker(options: WorkerOptions = {}): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? getWorkerPollIntervalMs();
  const prisma = getPrismaClient();
  const pipeline = createIngestionPipeline(
    createPrismaIngestionRepository(prisma),
    createLocalPdfStorageReader()
  );
  const embeddingService = {
    embedPaper(input: EmbedPaperInput) {
      return createConfiguredEmbeddingService(prisma).embedPaper(input);
    }
  };
  const jobRunner = createJobRunner(createPrismaJobRunnerRepository(prisma), pipeline, embeddingService);

  while (!options.stopSignal?.aborted) {
    const result = await jobRunner.runNext();

    if (result.status === "idle") {
      await sleep(pollIntervalMs, options.stopSignal);
    }
  }
}

function getWorkerPollIntervalMs(): number {
  const rawValue = process.env.WORKER_POLL_INTERVAL_MS;
  const parsed = rawValue ? Number(rawValue) : DEFAULT_POLL_INTERVAL_MS;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_INTERVAL_MS;
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
  const stop = () => abortController.abort();

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await startWorker({ stopSignal: abortController.signal });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
