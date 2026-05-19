# Worker, PDF Parsing, And Chunking

Thread E adds a local worker process that claims database-backed ingestion jobs, parses PDF text, creates deterministic chunks, and stores parser output for later retrieval work.

## Run Locally

Install dependencies and generate the Prisma client first:

```bash
corepack pnpm install
corepack pnpm db:generate
```

Run the worker as a separate development process:

```bash
corepack pnpm worker
```

Required environment:

```text
DATABASE_URL=postgresql://...
LOCAL_STORAGE_DIR=.data/uploads
WORKER_POLL_INTERVAL_MS=5000
```

`WORKER_POLL_INTERVAL_MS` is optional. `LOCAL_STORAGE_DIR` defaults to `.data/uploads`.

## Job Behavior

- The worker looks for queued `PARSE_PAPER` jobs whose `runAfter` is due.
- It claims one job at a time by moving it to `RUNNING`, incrementing `attempts`, and setting lock fields.
- On success, the job is marked `SUCCEEDED`.
- On failure, the job records an error message. Jobs with remaining attempts are re-queued with a short delay; exhausted jobs are marked `FAILED`.
- Redis, BullMQ, RabbitMQ, and other queue systems are intentionally not used for the MVP.

## Parsing And Chunking

- `pdf-parse` is used for TypeScript-friendly PDF text extraction. It wraps PDF.js and supports page-wise text extraction in Node without adding a separate queue or service.
- Text is extracted page by page with 1-based page numbers.
- Parser output includes raw page text, text-density diagnostics, metadata candidates, section candidates, and reference candidates.
- Low-text or likely scanned PDFs are marked failed instead of silently producing weak chunks.
- Chunking is deterministic and section-aware when headings are available, otherwise page-aware.
- Chunks preserve page ranges, character offsets where feasible, page-local offsets, section labels, content hashes, and `chunkVersion`.
- Chunks do not include embeddings in this thread. The required `embeddingModel` column is written as `pending` until Thread F owns embedding generation.

## Thread D Integration TODO

Thread D upload/storage code is not present on `origin/main` for this implementation. The ingestion pipeline therefore depends on a narrow storage interface:

```ts
readOriginalPdf(storageKey): Promise<Buffer>
```

The current worker includes a local filesystem adapter using `LOCAL_STORAGE_DIR`. Once Thread D lands, wire this interface to `storageService` instead of changing parser or chunker code.

## Thread F Integration TODO

After successful parsing and chunking, the pipeline marks the paper `READY` and leaves a TODO where Thread F should enqueue embedding work or update the status transition to `EMBEDDING`, depending on the retrieval implementation.
