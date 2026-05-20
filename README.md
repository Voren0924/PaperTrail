# PaperTrail

PaperTrail is a full-stack AI research assistant for computer science papers.
The planned MVP lets students upload academic PDFs, extract paper text and
metadata, ask citation-grounded questions, compare evidence, and turn cited
answers into reusable research notes.

## Current Status

The MVP vertical slice is implemented through Threads A-H:

- monorepo foundation;
- database and Prisma schema;
- auth and API error foundation;
- paper upload and local storage;
- worker-based PDF parsing and chunking;
- embeddings and retrieval;
- grounded answering and chat API;
- frontend application UI for auth, upload, paper detail, status, chat, and citations.

Notes, comparison, annotation export, billing, admin, and OCR remain outside the
MVP scope.

## Repository Structure

```text
apps/
  web/              Next.js App Router UI, API routes, services, and worker
packages/
  config/           Shared ESLint, Prettier, and TypeScript configuration
  shared/           Shared TypeScript utilities and types
  db/               Prisma schema, migrations, and database helpers
docs/
  DEVELOPMENT_PLAN.md
scripts/
  codex-finish.ps1
```

## Prerequisites

- Node.js LTS.
- Corepack enabled for package manager shims.
- pnpm, managed through Corepack.
- Docker Desktop or a local PostgreSQL installation for later database work.

PostgreSQL with pgvector is required for database-backed API routes, migrations,
worker processing, vector retrieval, and local end-to-end use. Unit tests use
mocks/fakes where possible and do not call real LLM or embedding APIs.

## Developer Setup

Install workspace dependencies:

```powershell
corepack pnpm install
```

Create a local `.env.local` or environment with placeholder values from
`.env.example`, then set real server-side provider keys locally:

```text
DATABASE_URL=postgresql://papertrail:papertrail@localhost:5432/papertrail
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=.data/uploads
MAX_UPLOAD_MB=50
WORKER_POLL_INTERVAL_MS=5000
CHAT_PROVIDER=openai-compatible
CHAT_BASE_URL=https://api.openai.com/v1
CHAT_API_KEY=<local secret>
CHAT_MODEL=gpt-4o-mini
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=<local secret>
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

Do not commit `.env.local`, real API keys, uploaded PDFs, or `.data`.

Generate the Prisma client and apply migrations:

```powershell
corepack pnpm db:generate
corepack pnpm db:migrate
```

Start the web app in development mode:

```powershell
corepack pnpm dev
```

Run the worker in a second terminal:

```powershell
corepack pnpm worker
```

Run linting:

```powershell
corepack pnpm lint
```

Run TypeScript checks:

```powershell
corepack pnpm typecheck
```

Run tests:

```powershell
corepack pnpm test
```

## Local Upload Storage

Uploaded PDFs are stored through a storage service abstraction. The MVP adapter
writes files to local disk and stores only metadata plus a storage key in
PostgreSQL.

Configure local uploads with:

```text
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=.data/uploads
MAX_UPLOAD_MB=50
```

`LOCAL_STORAGE_DIR` is resolved relative to the web app process working
directory when a relative path is provided. Keep it outside publicly served
directories such as `apps/web/public`. The default `.data/uploads` path is
already ignored by Git, and uploaded PDFs must not be committed.

## Codex Workflow

- Use one branch per task, named `codex/<task-name>`.
- Use one Git worktree per task so parallel Codex threads do not interfere with
  each other.
- Keep each task scoped to its assigned files and workstream.
- At task completion, run:

```powershell
scripts/codex-finish.ps1 -Message "clear commit message"
```

- Push the current `codex/<task-name>` branch.
- Open a pull request targeting `main`.
- Do not merge pull requests automatically.

The finish script is intentionally limited to `codex/` branches. It checks the
current status, refuses common secret and upload paths, commits staged task
changes, and pushes the current branch to `origin`.

