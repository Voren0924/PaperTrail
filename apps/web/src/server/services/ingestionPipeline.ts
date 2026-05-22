import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { getDefaultAppDataDir, type PrismaClient } from "@papertrail/db";

import { createPaperChunks, type PaperChunkInput } from "./chunkingService";
import {
  parsePdfBytes,
  PdfParsingError,
  type MetadataCandidates,
  type ParsePdfResult,
  type ParsedPdfPage,
  type ReferenceCandidate,
  type SectionCandidate
} from "./parsingService";

export type PaperForIngestion = {
  id: string;
  storageKey: string;
};

export type PersistedSection = {
  id: string;
  normalizedTitle: string;
  position: number;
};

export type PersistParsedPaperInput = {
  paperId: string;
  pageCount: number;
  metadata: MetadataCandidates;
  pages: ParsedPdfPage[];
  sections: SectionCandidate[];
  references: ReferenceCandidate[];
  chunks: PaperChunkInput[];
};

export type IngestionRepository = {
  findPaperForIngestion(paperId: string): Promise<PaperForIngestion | null>;
  markPaperParsing(paperId: string, message: string): Promise<void>;
  persistParsedPaper(input: PersistParsedPaperInput): Promise<void>;
  enqueueEmbeddingJob(paperId: string): Promise<void>;
  markPaperReady(paperId: string, message: string): Promise<void>;
  markPaperFailed(paperId: string, message: string): Promise<void>;
};

export type PdfStorageReader = {
  readOriginalPdf(storageKey: string): Promise<ReadOriginalPdfResult>;
};

export type ReadOriginalPdfResult = {
  bytes?: Buffer;
  filePath: string;
  fileExists: boolean;
  fileSize: number;
};

export type IngestionLogger = {
  info(message: string, metadata?: Record<string, unknown>): void;
};

export type RunIngestionPipelineInput = {
  paperId: string;
};

export type RunIngestionPipelineResult = {
  paperId: string;
  pageCount: number;
  parsedTextLength: number;
  chunkCount: number;
  referenceCount: number;
};

export class IngestionPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionPipelineError";
  }
}

export class UnsupportedPdfError extends IngestionPipelineError {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPdfError";
  }
}

export function createIngestionPipeline(
  repository: IngestionRepository,
  storageReader: PdfStorageReader,
  logger: IngestionLogger = console
) {
  return {
    async run(
      input: RunIngestionPipelineInput
    ): Promise<RunIngestionPipelineResult> {
      await repository.markPaperParsing(
        input.paperId,
        "Parsing PDF and creating chunks."
      );
      let pdfMetadata: Omit<ReadOriginalPdfResult, "bytes"> | null = null;

      try {
        const paper = await repository.findPaperForIngestion(input.paperId);

        if (!paper) {
          throw new IngestionPipelineError("Paper not found for ingestion.");
        }

        const pdf = await storageReader.readOriginalPdf(paper.storageKey);
        pdfMetadata = {
          filePath: pdf.filePath,
          fileExists: pdf.fileExists,
          fileSize: pdf.fileSize
        };
        logger.info("worker document input", {
          documentId: input.paperId,
          statusTransition: "UPLOADED/PARSING -> PARSING",
          ...pdfMetadata
        });

        if (!pdf.bytes) {
          throw new IngestionPipelineError("Original PDF file does not exist.");
        }

        const parsed = await parsePdfBytes(pdf.bytes);
        assertParsedPdfIsSupported(parsed);

        const chunks = createPaperChunks({
          pages: parsed.pages,
          sections: parsed.sections
        });

        if (chunks.length === 0) {
          throw new UnsupportedPdfError(
            "PDF did not produce any usable chunks."
          );
        }

        logger.info("worker document parsed", {
          documentId: input.paperId,
          statusTransition: "PARSING -> EMBEDDING",
          filePath: pdf.filePath,
          fileExists: pdf.fileExists,
          fileSize: pdf.fileSize,
          parsedTextLength: getParsedTextLength(parsed),
          chunkCount: chunks.length
        });

        await repository.persistParsedPaper({
          paperId: input.paperId,
          pageCount: parsed.pageCount,
          metadata: parsed.metadata,
          pages: parsed.pages,
          sections: parsed.sections,
          references: parsed.references,
          chunks
        });
        await repository.enqueueEmbeddingJob(input.paperId);

        return {
          paperId: input.paperId,
          pageCount: parsed.pageCount,
          parsedTextLength: getParsedTextLength(parsed),
          chunkCount: chunks.length,
          referenceCount: parsed.references.length
        };
      } catch (error) {
        const message = getPipelineErrorMessage(error);
        await repository.markPaperFailed(input.paperId, message);
        logger.info("worker document parsing failed", {
          documentId: input.paperId,
          statusTransition: "PARSING -> FAILED",
          ...(pdfMetadata ?? {}),
          errorMessage: message
        });
        throw error instanceof IngestionPipelineError
          ? error
          : new IngestionPipelineError(message);
      }
    }
  };
}

export function createPrismaIngestionRepository(
  prisma: PrismaClient
): IngestionRepository {
  return {
    async findPaperForIngestion(paperId) {
      const paper = await prisma.paper.findUnique({
        where: { id: paperId },
        select: { id: true, storageKey: true }
      });

      return paper;
    },
    async markPaperParsing(paperId, message) {
      await prisma.paper.update({
        where: { id: paperId },
        data: {
          status: "PARSING",
          statusMessage: message
        }
      });
    },
    async persistParsedPaper(input) {
      await prisma.$transaction(async (transaction) => {
        await transaction.paperChunk.deleteMany({
          where: { paperId: input.paperId }
        });
        await transaction.paperReference.deleteMany({
          where: { paperId: input.paperId }
        });
        await transaction.paperSection.deleteMany({
          where: { paperId: input.paperId }
        });
        await transaction.paperPage.deleteMany({
          where: { paperId: input.paperId }
        });
        await transaction.paperAuthor.deleteMany({
          where: { paperId: input.paperId }
        });

        await transaction.paper.update({
          where: { id: input.paperId },
          data: {
            title: input.metadata.titleCandidate,
            abstract: input.metadata.abstractCandidate,
            pageCount: input.pageCount,
            metadataConfidence: input.metadata.titleCandidate ? 0.6 : 0.2
          }
        });

        if (input.metadata.authorCandidates.length > 0) {
          await transaction.paperAuthor.createMany({
            data: input.metadata.authorCandidates.map((name, position) => ({
              paperId: input.paperId,
              name,
              position
            }))
          });
        }

        await transaction.paperPage.createMany({
          data: input.pages.map((page) => ({
            paperId: input.paperId,
            pageNumber: page.pageNumber,
            text: page.text,
            charCount: page.charCount
          }))
        });

        const sectionRecords: PersistedSection[] = [];

        for (const section of deriveSectionRanges(input.sections)) {
          const created = await transaction.paperSection.create({
            data: {
              paperId: input.paperId,
              title: section.title,
              normalizedTitle: section.normalizedTitle,
              startPage: section.startPage,
              endPage: section.endPage,
              position: section.position
            },
            select: {
              id: true,
              normalizedTitle: true,
              position: true
            }
          });

          sectionRecords.push(created);
        }

        if (input.references.length > 0) {
          await transaction.paperReference.createMany({
            data: input.references.map((reference) => ({
              paperId: input.paperId,
              rawText: reference.rawText,
              title: reference.title,
              authorsText: reference.authorsText,
              year: reference.year,
              position: reference.position
            }))
          });
        }

        await transaction.paperChunk.createMany({
          data: input.chunks.map((chunk) => ({
            paperId: input.paperId,
            sectionId: resolveSectionId(chunk, sectionRecords),
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            tokenCount: chunk.tokenCount,
            startPage: chunk.pageStart,
            endPage: chunk.pageEnd,
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            pageTextOffsets: chunk.pageTextOffsets,
            contentHash: chunk.contentHash,
            chunkVersion: chunk.chunkVersion,
            embeddingModel: chunk.embeddingModel
          }))
        });
      });
    },
    async enqueueEmbeddingJob(paperId) {
      await prisma.job.create({
        data: {
          type: "EMBED_PAPER",
          paperId,
          payload: { paperId }
        }
      });
      await prisma.paper.update({
        where: { id: paperId },
        data: {
          status: "EMBEDDING",
          statusMessage: "Queued paper chunks for embedding."
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

export function createLocalPdfStorageReader(
  baseDir = process.env.PAPERTRAIL_APP_DATA_DIR ??
    process.env.LOCAL_STORAGE_DIR ??
    getDefaultAppDataDir()
): PdfStorageReader {
  const root = resolve(baseDir);

  return {
    async readOriginalPdf(storageKey) {
      // TODO(Thread D): replace this with the storageService adapter once upload storage lands.
      const filePath = resolve(root, storageKey);

      const relativePath = relative(root, filePath);

      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new IngestionPipelineError(
          "Storage key resolves outside the configured upload directory."
        );
      }

      const fileStats = await stat(filePath).catch(() => null);

      if (!fileStats?.isFile()) {
        return {
          filePath,
          fileExists: false,
          fileSize: 0
        };
      }

      return {
        bytes: await readFile(filePath),
        filePath,
        fileExists: true,
        fileSize: fileStats.size
      };
    }
  };
}

function getParsedTextLength(parsed: ParsePdfResult): number {
  return parsed.pages.reduce((total, page) => total + page.text.length, 0);
}

function assertParsedPdfIsSupported(parsed: ParsePdfResult): void {
  if (parsed.pageCount === 0) {
    throw new UnsupportedPdfError("PDF has no readable pages.");
  }

  if (parsed.isLikelyScanned) {
    throw new UnsupportedPdfError(
      "PDF appears to be scanned or has too little extractable text."
    );
  }
}

function getPipelineErrorMessage(error: unknown): string {
  if (
    error instanceof UnsupportedPdfError ||
    error instanceof IngestionPipelineError
  ) {
    return error.message;
  }

  if (error instanceof PdfParsingError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Paper ingestion failed.";
}

function deriveSectionRanges(sections: SectionCandidate[]): Array<{
  title: string;
  normalizedTitle: string;
  startPage: number;
  endPage: number;
  position: number;
}> {
  return sections.map((section, index) => ({
    title: section.title,
    normalizedTitle: section.normalizedTitle,
    startPage: section.pageNumber,
    endPage: sections[index + 1]?.pageNumber ?? section.pageNumber,
    position: section.position
  }));
}

function resolveSectionId(
  chunk: PaperChunkInput,
  sectionRecords: PersistedSection[]
): string | null {
  if (!chunk.sectionNormalizedTitle) {
    return null;
  }

  return (
    sectionRecords.find(
      (section) => section.normalizedTitle === chunk.sectionNormalizedTitle
    )?.id ?? null
  );
}
