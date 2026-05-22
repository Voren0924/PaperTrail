# Worker, PDF Parsing, And Chunking

Desktop MVP update: the worker reads PDFs from the local app data directory (`PAPERTRAIL_APP_DATA_DIR`, default repo-root `.data/PaperTrail`) and uses provider settings saved in SQLite for embedding jobs. PostgreSQL and pgvector are no longer required for the MVP.

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

Optional environment:

```text
DATABASE_URL=file:../../../.data/PaperTrail/papertrail.db
PAPERTRAIL_APP_DATA_DIR=D:\PaperTrail\.data\PaperTrail
STORAGE_DRIVER=local
WORKER_POLL_INTERVAL_MS=5000
```

`DATABASE_URL` is optional at runtime. If it is unset, `@papertrail/db` points Prisma at the repo-root `.data/PaperTrail/papertrail.db` file and creates the directory. `PAPERTRAIL_APP_DATA_DIR` should be absolute when set manually so the web app, worker, and Prisma CLI do not diverge by working directory. Provider keys are saved from the local Settings screen and must not be committed.

Prisma CLI commands do not reliably read a root `.env` when they are run from the `packages/db` workspace. Use the root scripts with an exported `DATABASE_URL`, or copy only local non-secret path settings into `packages/db/.env` if you need Prisma CLI dotenv loading.

## Job Behavior

- The worker looks for queued `PARSE_PAPER`, `RETRY_PAPER`, and `EMBED_PAPER` jobs whose `runAfter` is due.
- It claims one job at a time by moving it to `RUNNING`, incrementing `attempts`, and setting lock fields.
- On success, the job is marked `SUCCEEDED`.
- On failure, the job records an error message. Jobs with remaining attempts are re-queued with a short delay; exhausted jobs are marked `FAILED`.
- Parsing and embedding failures also mark the paper `FAILED` with a visible status message so documents do not remain stuck in `PARSING` or `EMBEDDING`.
- The worker logs startup, sanitized database target, poll interval, each polling cycle, document file metadata, parsed text length, chunk count, embedding count, and shutdown.
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
- The embedding job writes local JSON embeddings, updates chunk `embeddingModel`, and marks the paper `READY`.
- `RETRY_PAPER` reruns parsing and chunking for the existing paper, then enqueues a fresh embedding job.
