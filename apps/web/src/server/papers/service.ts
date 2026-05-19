import { ensureOwnedRecord } from "@/server/auth/ownership";
import { getStorageConfig, type StorageConfig } from "@/server/storage/config";
import { sha256Hex } from "@/server/storage/hash";
import { createPdfStorageKey } from "@/server/storage/keys";
import { createStorageAdapter, type StorageAdapter } from "@/server/storage";

import { createPrismaPaperRepository, type JobRecord, type PaperRecord, type PaperRepository } from "./repository";
import { validateUploadedPdf } from "./validation";

export type PaperService = {
  uploadPaper(input: { currentUserId: string; file: FormDataEntryValue | null }): Promise<PaperUploadResult>;
  listPapers(input: { currentUserId: string }): Promise<{ papers: PaperApiRecord[] }>;
  getPaper(input: { currentUserId: string; paperId: string }): Promise<{ paper: PaperApiRecord }>;
  deletePaper(input: { currentUserId: string; paperId: string }): Promise<{ paperId: string }>;
  retryPaper(input: { currentUserId: string; paperId: string }): Promise<{ paper: PaperApiRecord; job: JobApiRecord }>;
};

export type PaperUploadResult = {
  paper: PaperApiRecord;
  job: JobApiRecord;
};

export type PaperApiRecord = {
  id: string;
  title: string | null;
  abstract: string | null;
  originalFileName: string;
  fileSha256: string;
  pageCount: number | null;
  status: string;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobApiRecord = {
  id: string;
  paperId: string | null;
  type: string;
  status: string;
};

export function createPaperService(
  repository: PaperRepository = createPrismaPaperRepository(),
  storage: StorageAdapter = createStorageAdapter(),
  config: StorageConfig = getStorageConfig()
): PaperService {
  return {
    async uploadPaper(input) {
      const file = validateUploadedPdf(input.file, config);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileSha256 = sha256Hex(bytes);
      const storageKey = createPdfStorageKey({
        userId: input.currentUserId,
        originalFileName: file.name,
        fileSha256
      });

      await storage.putObject({
        storageKey,
        bytes,
        contentType: file.type || "application/pdf"
      });

      try {
        const result = await repository.createPaperWithParseJob({
          userId: input.currentUserId,
          originalFileName: file.name,
          storageKey,
          fileSha256
        });

        return {
          paper: toPaperApiRecord(result.paper),
          job: toJobApiRecord(result.job)
        };
      } catch (error) {
        await storage.deleteObject({ storageKey }).catch(() => undefined);
        throw error;
      }
    },

    async listPapers(input) {
      const papers = await repository.listPapersForUser(input.currentUserId);

      return { papers: papers.map(toPaperApiRecord) };
    },

    async getPaper(input) {
      const paper = ensureOwnedRecord(await repository.findPaperById(input.paperId), input.currentUserId, {
        resourceName: "Paper"
      });

      return { paper: toPaperApiRecord(paper) };
    },

    async deletePaper(input) {
      const paper = ensureOwnedRecord(await repository.findPaperById(input.paperId), input.currentUserId, {
        resourceName: "Paper"
      });

      await repository.deletePaper(paper.id);
      await storage.deleteObject({ storageKey: paper.storageKey });

      return { paperId: paper.id };
    },

    async retryPaper(input) {
      const paper = ensureOwnedRecord(await repository.findPaperById(input.paperId), input.currentUserId, {
        resourceName: "Paper"
      });
      const job = await repository.createRetryJob(paper.id);

      return {
        paper: toPaperApiRecord(paper),
        job: toJobApiRecord(job)
      };
    }
  };
}

export function toPaperApiRecord(paper: PaperRecord): PaperApiRecord {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    originalFileName: paper.originalFileName,
    fileSha256: paper.fileSha256,
    pageCount: paper.pageCount,
    status: paper.status,
    statusMessage: paper.statusMessage,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString()
  };
}

export function toJobApiRecord(job: JobRecord): JobApiRecord {
  return {
    id: job.id,
    paperId: job.paperId,
    type: job.type,
    status: job.status
  };
}
