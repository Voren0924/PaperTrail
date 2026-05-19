import { describe, expect, it } from "vitest";

import {
  createJobRunner,
  type IngestionJob,
  type JobRunnerRepository
} from "./jobRunner";
import type { IngestionPipelineHandler } from "./jobRunner";

describe("job runner", () => {
  it("claims a queued ingestion job and records success", async () => {
    const repository = createMemoryJobRepository([
      createJob({ id: "job-1", paperId: "paper-1" })
    ]);
    const pipeline: IngestionPipelineHandler = {
      run: (input) => Promise.resolve({
        paperId: input.paperId,
        pageCount: 2,
        chunkCount: 3,
        referenceCount: 1
      })
    };
    const runner = createJobRunner(repository, pipeline, {
      workerId: "worker-test",
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    await expect(runner.runNext()).resolves.toEqual({
      status: "succeeded",
      jobId: "job-1"
    });
    expect(repository.events).toContain("claimed:job-1:worker-test");
    expect(repository.events).toContain("succeeded:job-1:Parsed 2 pages into 3 chunks.");
  });

  it("records failure diagnostics when the ingestion pipeline fails", async () => {
    const repository = createMemoryJobRepository([
      createJob({ id: "job-1", paperId: "paper-1", attempts: 3, maxAttempts: 3 })
    ]);
    const pipeline: IngestionPipelineHandler = {
      run: () => Promise.reject(new Error("parse failed"))
    };
    const runner = createJobRunner(repository, pipeline, {
      now: () => new Date("2026-05-19T00:00:00.000Z")
    });

    await expect(runner.runNext()).resolves.toEqual({
      status: "failed",
      jobId: "job-1",
      errorMessage: "parse failed"
    });
    expect(repository.events).toContain("failed:job-1:parse failed");
  });

  it("returns idle when no queued ingestion job is available", async () => {
    const runner = createJobRunner(createMemoryJobRepository([]), {
      run: () => Promise.reject(new Error("should not run"))
    });

    await expect(runner.runNext()).resolves.toEqual({ status: "idle" });
  });
});

function createMemoryJobRepository(jobs: IngestionJob[]): JobRunnerRepository & { events: string[] } {
  const events: string[] = [];

  return {
    events,
    claimNextIngestionJob(workerId) {
      const job = jobs.find((candidate) => candidate.status === "QUEUED") ?? null;

      if (!job) {
        return Promise.resolve(null);
      }

      job.status = "RUNNING";
      job.attempts += 1;
      events.push(`claimed:${job.id}:${workerId}`);

      return Promise.resolve(job);
    },
    markJobSucceeded(jobId, message) {
      events.push(`succeeded:${jobId}:${message}`);
      return Promise.resolve();
    },
    markJobFailed(job, errorMessage) {
      events.push(`failed:${job.id}:${errorMessage}`);
      return Promise.resolve();
    }
  };
}

function createJob(input: {
  id: string;
  paperId: string;
  attempts?: number;
  maxAttempts?: number;
}): IngestionJob {
  return {
    id: input.id,
    type: "PARSE_PAPER",
    status: "QUEUED",
    paperId: input.paperId,
    payload: {},
    attempts: input.attempts ?? 0,
    maxAttempts: input.maxAttempts ?? 3
  };
}
