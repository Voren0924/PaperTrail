import { describe, expect, it } from "vitest";

import { runWorkerLoop, type WorkerLogger } from "./worker";

describe("worker loop", () => {
  it("processes pending documents and logs polling summaries", async () => {
    const abortController = new AbortController();
    const logger = createMemoryLogger();

    await runWorkerLoop({
      pollIntervalMs: 1,
      stopSignal: abortController.signal,
      logger,
      runNext: () => {
        abortController.abort();

        return Promise.resolve({
          status: "succeeded",
          jobId: "job-1",
          jobType: "PARSE_PAPER",
          paperId: "paper-1",
          message: "Parsed 1 pages into 2 chunks.",
          metrics: {
            parsedTextLength: 1000,
            chunkCount: 2
          }
        });
      }
    });

    expect(logger.messages).toContain("info:worker polling cycle");
    expect(logger.metadata).toContainEqual(
      expect.objectContaining({
        status: "succeeded",
        documentId: "paper-1",
        chunkCount: 2
      })
    );
  });

  it("does not exit after one empty poll", async () => {
    const abortController = new AbortController();
    let cycles = 0;

    await runWorkerLoop({
      pollIntervalMs: 1,
      stopSignal: abortController.signal,
      logger: createMemoryLogger(),
      runNext: () => {
        cycles += 1;

        return Promise.resolve({ status: "idle" });
      },
      sleepFn: () => {
        if (cycles >= 3) {
          abortController.abort();
        }

        return Promise.resolve();
      }
    });

    expect(cycles).toBe(3);
  });

  it("catches polling errors and keeps polling", async () => {
    const abortController = new AbortController();
    const logger = createMemoryLogger();
    let cycles = 0;

    await runWorkerLoop({
      pollIntervalMs: 1,
      stopSignal: abortController.signal,
      logger,
      runNext: () => {
        cycles += 1;

        if (cycles === 1) {
          return Promise.reject(new Error("temporary database error"));
        }

        abortController.abort();
        return Promise.resolve({ status: "idle" });
      },
      sleepFn: () => Promise.resolve()
    });

    expect(cycles).toBe(2);
    expect(logger.messages).toContain("error:worker polling cycle failed");
  });
});

function createMemoryLogger(): WorkerLogger & {
  messages: string[];
  metadata: Array<Record<string, unknown>>;
} {
  const messages: string[] = [];
  const metadata: Array<Record<string, unknown>> = [];

  return {
    messages,
    metadata,
    info(message, data) {
      messages.push(`info:${message}`);
      metadata.push(data ?? {});
    },
    error(message, data) {
      messages.push(`error:${message}`);
      metadata.push(data ?? {});
    }
  };
}
