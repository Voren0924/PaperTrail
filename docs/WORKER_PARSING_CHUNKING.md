# Worker, PDF Parsing, And Chunking

Desktop MVP update: the worker reads PDFs from the local app data directory (`PAPERTRAIL_APP_DATA_DIR`, default `.data/PaperTrail`) and uses provider settings saved in SQLite for embedding jobs. PostgreSQL and pgvector are no longer required for the MVP.

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
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=.data/uploads
WORKER_POLL_INTERVAL_MS=5000
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

`WORKER_POLL_INTERVAL_MS` is optional. `LOCAL_STORAGE_DIR` defaults to `.data/uploads`.
Provider keys must be supplied only through local or deployment environment files.

## Job Behavior

- The worker looks for queued `PARSE_PAPER`, `RETRY_PAPER`, and `EMBED_PAPER` jobs whose `runAfter` is due.
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
- Chunks are first stored with `embeddingModel` set to `pending`.
- After parsing, the ingestion pipeline enqueues `EMBED_PAPER` and marks the paper `EMBEDDING`.
- The embedding job writes pgvector embeddings, updates chunk `embeddingModel`, and marks the paper `READY`.
- `RETRY_PAPER` reruns parsing and chunking for the existing paper, then enqueues a fresh embedding job.
