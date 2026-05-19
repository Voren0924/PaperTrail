import { getPrismaClient, type PrismaClient } from "@papertrail/db";

export type PaperRecord = {
  id: string;
  userId: string;
  title: string | null;
  abstract: string | null;
  originalFileName: string;
  storageKey: string;
  fileSha256: string;
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
  userId: string;
  originalFileName: string;
  storageKey: string;
  fileSha256: string;
};

export type PaperRepository = {
  createPaperWithParseJob(input: CreatePaperInput): Promise<{ paper: PaperRecord; job: JobRecord }>;
  listPapersForUser(userId: string): Promise<PaperRecord[]>;
  findPaperById(paperId: string): Promise<PaperRecord | null>;
  deletePaper(paperId: string): Promise<void>;
  createRetryJob(paperId: string): Promise<JobRecord>;
};

export function createPrismaPaperRepository(prisma: PrismaClient = getPrismaClient()): PaperRepository {
  return {
    async createPaperWithParseJob(input) {
      return prisma.$transaction(async (tx) => {
        const paper = await tx.paper.create({
          data: {
            userId: input.userId,
            originalFileName: input.originalFileName,
            storageKey: input.storageKey,
            fileSha256: input.fileSha256,
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
