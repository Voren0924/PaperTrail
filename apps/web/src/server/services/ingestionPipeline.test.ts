import { describe, expect, it } from "vitest";

import {
  createIngestionPipeline,
  type IngestionRepository,
  type PersistParsedPaperInput,
  UnsupportedPdfError
} from "./ingestionPipeline";

describe("ingestion pipeline", () => {
  it("persists parsed pages, sections, references, and chunks before enqueueing embeddings", async () => {
    const repository = createMemoryRepository();
    const pipeline = createIngestionPipeline(repository, {
      readOriginalPdf: () =>
        Promise.resolve(
          createPdfResult(
            createMinimalPdf(repeatSentence("Reliable parser text.", 80))
          )
        )
    });

    await expect(pipeline.run({ paperId: "paper-1" })).resolves.toMatchObject({
      paperId: "paper-1",
      pageCount: 1,
      chunkCount: 1
    });

    expect(repository.persisted).toHaveLength(1);
    expect(repository.persisted[0]?.pages).toHaveLength(1);
    expect(repository.persisted[0]?.chunks).toHaveLength(1);
    expect(repository.statuses.at(-1)).toMatchObject({
      status: "EMBEDDING"
    });
    expect(repository.embeddingJobs).toEqual(["paper-1"]);
  });

  it("marks low-text PDFs failed instead of producing low-quality chunks", async () => {
    const repository = createMemoryRepository();
    const pipeline = createIngestionPipeline(repository, {
      readOriginalPdf: () =>
        Promise.resolve(createPdfResult(createMinimalPdf("short")))
    });

    await expect(pipeline.run({ paperId: "paper-1" })).rejects.toThrow(
      UnsupportedPdfError
    );
    expect(repository.persisted).toHaveLength(0);
    expect(repository.statuses.at(-1)).toMatchObject({
      status: "FAILED",
      message: "PDF appears to be scanned or has too little extractable text."
    });
  });

  it("marks unreadable PDFs failed with diagnostics", async () => {
    const repository = createMemoryRepository();
    const pipeline = createIngestionPipeline(repository, {
      readOriginalPdf: () =>
        Promise.resolve(createPdfResult(Buffer.from("not a pdf")))
    });

    await expect(pipeline.run({ paperId: "paper-1" })).rejects.toThrow(
      "Unable to read PDF text."
    );
    expect(repository.statuses.at(-1)).toMatchObject({
      status: "FAILED",
      message: "Unable to read PDF text."
    });
  });

  it("marks missing PDF files failed instead of leaving the document processing", async () => {
    const repository = createMemoryRepository();
    const pipeline = createIngestionPipeline(repository, {
      readOriginalPdf: () =>
        Promise.resolve({
          filePath: "D:\\PaperTrail\\.data\\PaperTrail\\missing.pdf",
          fileExists: false,
          fileSize: 0
        })
    });

    await expect(pipeline.run({ paperId: "paper-1" })).rejects.toThrow(
      "Original PDF file does not exist."
    );
    expect(repository.statuses.at(-1)).toMatchObject({
      status: "FAILED",
      message: "Original PDF file does not exist."
    });
  });
});

function createPdfResult(bytes: Buffer) {
  return {
    bytes,
    filePath: "D:\\PaperTrail\\.data\\PaperTrail\\paper.pdf",
    fileExists: true,
    fileSize: bytes.length
  };
}

function createMemoryRepository(): IngestionRepository & {
  persisted: PersistParsedPaperInput[];
  statuses: Array<{ status: string; message: string }>;
  embeddingJobs: string[];
} {
  const persisted: PersistParsedPaperInput[] = [];
  const statuses: Array<{ status: string; message: string }> = [];
  const embeddingJobs: string[] = [];

  return {
    persisted,
    statuses,
    embeddingJobs,
    findPaperForIngestion() {
      return Promise.resolve({ id: "paper-1", storageKey: "paper.pdf" });
    },
    markPaperParsing(_paperId, message) {
      statuses.push({ status: "PARSING", message });
      return Promise.resolve();
    },
    persistParsedPaper(input) {
      persisted.push(input);
      return Promise.resolve();
    },
    enqueueEmbeddingJob(paperId) {
      embeddingJobs.push(paperId);
      statuses.push({
        status: "EMBEDDING",
        message: "Queued paper chunks for embedding."
      });
      return Promise.resolve();
    },
    markPaperReady(_paperId, message) {
      statuses.push({ status: "READY", message });
      return Promise.resolve();
    },
    markPaperFailed(_paperId, message) {
      statuses.push({ status: "FAILED", message });
      return Promise.resolve();
    }
  };
}

function createMinimalPdf(text: string): Buffer {
  const lines = text.match(/.{1,72}(\s|$)/g) ?? [text];
  const operations = lines
    .map((line) => `(${escapePdfText(line.trim())}) Tj T*`)
    .join(" ");
  const stream = `BT /F1 12 Tf 14 TL 72 720 Td ${operations} ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length ${stream.length}>>stream
${stream}
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000230 00000 n 
0000000299 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
${stream.length + 349}
%%EOF`;

  return Buffer.from(pdf);
}

function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(" ");
}

function escapePdfText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}
