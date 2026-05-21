import { describe, expect, it } from "vitest";

import { NotFoundError } from "@/server/errors/application-error";
import type { StorageAdapter } from "@/server/storage";
import type { StorageConfig } from "@/server/storage/config";

import { createPaperService } from "./service";
import type { CreatePaperInput, JobRecord, PaperRecord, PaperRepository } from "./repository";

const storageConfig: StorageConfig = {
  driver: "local",
  localStorageDir: "/tmp/papertrail-test",
  maxUploadBytes: 1024,
  maxUploadMb: 1
};

describe("paper service", () => {
  it("stores the uploaded PDF, creates a paper, and queues a parse job", async () => {
    const repository = new FakePaperRepository();
    const storage = new FakeStorageAdapter();
    const service = createPaperService(repository, storage, storageConfig);
    const file = new File([new TextEncoder().encode("%PDF-1.7")], "paper.pdf", {
      type: "application/pdf"
    });

    const result = await service.uploadPaper({
      file
    });

    expect(result.paper.originalFileName).toBe("paper.pdf");
    expect(result.paper.status).toBe("UPLOADED");
    expect(result.paper.fileSha256).toBe("86edbaa24831badfa0a8b04bb410141e2ee4182b6d0014493fe262a7a331c20b");
    expect(result.job?.type).toBe("PARSE_PAPER");
    expect(result.paper.mimeType).toBe("application/pdf");
    expect(storage.objects.size).toBe(1);
  });

  it("reuses an existing imported PDF when the file hash already exists", async () => {
    const repository = new FakePaperRepository();
    const storage = new FakeStorageAdapter();
    const service = createPaperService(repository, storage, storageConfig);
    const file = new File([new TextEncoder().encode("%PDF-1.7")], "paper.pdf", {
      type: "application/pdf"
    });

    const first = await service.uploadPaper({ file });
    const second = await service.uploadPaper({ file });

    expect(second.paper.id).toBe(first.paper.id);
    expect(second.job).toBeNull();
    expect(storage.objects.size).toBe(1);
  });

  it("rolls back local storage when repository creation fails", async () => {
    const repository = new FakePaperRepository({ failCreates: true });
    const storage = new FakeStorageAdapter();
    const service = createPaperService(repository, storage, storageConfig);
    const file = new File([new TextEncoder().encode("%PDF")], "paper.pdf", {
      type: "application/pdf"
    });

    await expect(
      service.uploadPaper({
        file
      })
    ).rejects.toThrow("create failed");
    expect(storage.objects.size).toBe(0);
  });

  it("lists only records returned for the current user", async () => {
    const repository = new FakePaperRepository();
    const service = createPaperService(repository, new FakeStorageAdapter(), storageConfig);
    await repository.createPaperWithParseJob({
      userId: "user-1",
      id: "paper-a",
      originalFileName: "a.pdf",
      storageKey: "papers/user-1/a.pdf",
      fileSha256: "hash-a",
      mimeType: "application/pdf"
    });
    await repository.createPaperWithParseJob({
      userId: "user-2",
      id: "paper-b",
      originalFileName: "b.pdf",
      storageKey: "papers/user-2/b.pdf",
      fileSha256: "hash-b",
      mimeType: "application/pdf"
    });

    const result = await service.listPapers({ currentUserId: "user-1" });

    expect(result.papers).toHaveLength(1);
    expect(result.papers[0]?.originalFileName).toBe("a.pdf");
  });

  it("hides papers owned by another user", async () => {
    const repository = new FakePaperRepository();
    const service = createPaperService(repository, new FakeStorageAdapter(), storageConfig);
    const { paper } = await repository.createPaperWithParseJob({
      userId: "user-2",
      id: "paper-foreign",
      originalFileName: "paper.pdf",
      storageKey: "papers/user-2/paper.pdf",
      fileSha256: "hash",
      mimeType: "application/pdf"
    });

    await expect(service.getPaper({ currentUserId: "user-1", paperId: paper.id })).rejects.toThrow(NotFoundError);
    await expect(service.retryPaper({ currentUserId: "user-1", paperId: paper.id })).rejects.toThrow(NotFoundError);
    await expect(service.deletePaper({ currentUserId: "user-1", paperId: paper.id })).rejects.toThrow(NotFoundError);
  });

  it("deletes the database record and local object for owned papers", async () => {
    const repository = new FakePaperRepository();
    const storage = new FakeStorageAdapter();
    const service = createPaperService(repository, storage, storageConfig);
    const { paper } = await repository.createPaperWithParseJob({
      userId: "user-1",
      id: "paper-owned",
      originalFileName: "paper.pdf",
      storageKey: "papers/user-1/paper.pdf",
      fileSha256: "hash",
      mimeType: "application/pdf"
    });
    storage.objects.set(paper.storageKey, new Uint8Array([1]));

    await expect(service.deletePaper({ currentUserId: "user-1", paperId: paper.id })).resolves.toEqual({
      paperId: paper.id
    });
    expect(await repository.findPaperById(paper.id)).toBeNull();
    expect(storage.objects.has(paper.storageKey)).toBe(false);
  });

  it("creates a retry job for owned papers", async () => {
    const repository = new FakePaperRepository();
    const service = createPaperService(repository, new FakeStorageAdapter(), storageConfig);
    const { paper } = await repository.createPaperWithParseJob({
      userId: "user-1",
      id: "paper-retry",
      originalFileName: "paper.pdf",
      storageKey: "papers/user-1/paper.pdf",
      fileSha256: "hash",
      mimeType: "application/pdf"
    });

    const result = await service.retryPaper({ currentUserId: "user-1", paperId: paper.id });

    expect(result.job.type).toBe("RETRY_PAPER");
    expect(result.job.paperId).toBe(paper.id);
  });
});

class FakeStorageAdapter implements StorageAdapter {
  readonly objects = new Map<string, Uint8Array>();

  putObject(input: { storageKey: string; bytes: Uint8Array; contentType: string }) {
    this.objects.set(input.storageKey, input.bytes);
    return Promise.resolve({ storageKey: input.storageKey });
  }

  getObject(input: { storageKey: string }) {
    const bytes = this.objects.get(input.storageKey);

    if (!bytes) {
      return Promise.reject(new Error("missing object"));
    }

    return Promise.resolve(bytes);
  }

  deleteObject(input: { storageKey: string }) {
    this.objects.delete(input.storageKey);
    return Promise.resolve();
  }
}

class FakePaperRepository implements PaperRepository {
  readonly papers = new Map<string, PaperRecord>();
  readonly jobs = new Map<string, JobRecord>();
  private paperCounter = 0;
  private jobCounter = 0;
  private readonly failCreates: boolean;

  constructor(options: { failCreates?: boolean } = {}) {
    this.failCreates = options.failCreates ?? false;
  }

  createPaperWithParseJob(input: CreatePaperInput) {
    if (this.failCreates) {
      return Promise.reject(new Error("create failed"));
    }

    const paper = this.createPaper(input);
    const job = this.createJob("PARSE_PAPER", paper.id);

    return Promise.resolve({ paper, job });
  }

  listPapersForUser(userId: string) {
    return Promise.resolve([...this.papers.values()].filter((paper) => paper.userId === userId));
  }

  findPaperById(paperId: string) {
    return Promise.resolve(this.papers.get(paperId) ?? null);
  }

  findPaperByFileSha256(fileSha256: string) {
    return Promise.resolve([...this.papers.values()].find((paper) => paper.fileSha256 === fileSha256) ?? null);
  }

  deletePaper(paperId: string) {
    this.papers.delete(paperId);
    return Promise.resolve();
  }

  createRetryJob(paperId: string) {
    return Promise.resolve(this.createJob("RETRY_PAPER", paperId));
  }

  private createPaper(input: CreatePaperInput): PaperRecord {
    this.paperCounter += 1;

    const paper: PaperRecord = {
      id: input.id || `paper-${this.paperCounter}`,
      userId: input.userId,
      title: null,
      abstract: null,
      originalFileName: input.originalFileName,
      storageKey: input.storageKey,
      fileSha256: input.fileSha256,
      mimeType: input.mimeType,
      pageCount: null,
      status: "UPLOADED",
      statusMessage: "Queued for parsing.",
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
      updatedAt: new Date("2026-05-19T00:00:00.000Z")
    };

    this.papers.set(paper.id, paper);
    return paper;
  }

  private createJob(type: string, paperId: string): JobRecord {
    this.jobCounter += 1;

    const job = {
      id: `job-${this.jobCounter}`,
      paperId,
      type,
      status: "QUEUED"
    };

    this.jobs.set(job.id, job);
    return job;
  }
}
