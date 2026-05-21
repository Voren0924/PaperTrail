import { getPrismaClient, type PrismaClient } from "@papertrail/db";

import { ensureLocalUser, LOCAL_USER_ID } from "@/server/local/localUser";

export type PaperRecord = {
  id: string;
  userId: string;
  title: string | null;
  abstract: string | null;
  originalFileName: string;
  storageKey: string;
  fileSha256: string;
  mimeType: string;
  pageCount: number | null;
  status: string;
  statusMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JobRecord = {
  id: string;
  paperId: string | null;
  type: string;
  status: string;
};

export type CreatePaperInput = {
  id: string;
  userId: string;
  originalFileName: string;
  storageKey: string;
  fileSha256: string;
  mimeType: string;
};

export type PaperRepository = {
  createPaperWithParseJob(input: CreatePaperInput): Promise<{ paper: PaperRecord; job: JobRecord }>;
  listPapersForUser(userId: string): Promise<PaperRecord[]>;
  findPaperById(paperId: string): Promise<PaperRecord | null>;
  findPaperByFileSha256(fileSha256: string): Promise<PaperRecord | null>;
  deletePaper(paperId: string): Promise<void>;
  createRetryJob(paperId: string): Promise<JobRecord>;
};

export function createPrismaPaperRepository(prisma: PrismaClient = getPrismaClient()): PaperRepository {
  return {
    async createPaperWithParseJob(input) {
      await ensureLocalUser(prisma);
      return prisma.$transaction(async (tx) => {
        const paper = await tx.paper.create({
          data: {
            id: input.id,
            userId: input.userId || LOCAL_USER_ID,
            originalFileName: input.originalFileName,
            storageKey: input.storageKey,
            fileSha256: input.fileSha256,
            mimeType: input.mimeType,
            status: "UPLOADED",
            statusMessage: "Queued for parsing."
          }
        });

        const job = await tx.job.create({
          data: {
            type: "PARSE_PAPER",
            status: "QUEUED",
            paperId: paper.id,
            payload: {
              paperId: paper.id,
              storageKey: paper.storageKey,
              fileSha256: paper.fileSha256,
              originalFileName: paper.originalFileName
            }
          }
        });

        return { paper, job };
      });
    },

    listPapersForUser(userId) {
      return prisma.paper.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });
    },

    findPaperById(paperId) {
      return prisma.paper.findUnique({
        where: { id: paperId }
      });
    },

    findPaperByFileSha256(fileSha256) {
      return prisma.paper.findFirst({
        where: {
          userId: LOCAL_USER_ID,
          fileSha256
        },
        orderBy: { createdAt: "desc" }
      });
    },

    async deletePaper(paperId) {
      await prisma.paper.delete({
        where: { id: paperId }
      });
    },

    createRetryJob(paperId) {
      return prisma.job.create({
        data: {
          type: "RETRY_PAPER",
          status: "QUEUED",
          paperId,
          payload: { paperId }
        }
      });
    }
  };
}
