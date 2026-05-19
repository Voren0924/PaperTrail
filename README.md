# PaperTrail

PaperTrail is a full-stack AI research assistant for computer science papers.
The planned MVP lets students upload academic PDFs, extract paper text and
metadata, ask citation-grounded questions, compare evidence, and turn cited
answers into reusable research notes.

## Current Status

Thread A, the monorepo foundation, Thread B, the database/Prisma foundation, and
Thread C, the auth/API foundation, are complete.

Paper upload and local storage APIs are implemented in Thread D. PDF parsing,
RAG, grounded answering, comparison, and notes remain planned work.

## Repository Structure

```text
apps/
  web/              Next.js App Router frontend shell
packages/
  config/           Shared ESLint, Prettier, and TypeScript configuration
  shared/           Shared TypeScript utilities and types
  db/               Prisma schema, migrations, and database helpers
docs/
  DEVELOPMENT_PLAN.md
scripts/
  codex-finish.ps1
```

`packages/db` is planned or in progress for the database workstream. It may not
exist on every branch until that work is merged.

## Prerequisites

- Node.js LTS.
- Corepack enabled for package manager shims.
- pnpm, managed through Corepack.
- Docker Desktop or a local PostgreSQL installation for later database work.

PostgreSQL and pgvector are required for database-backed API routes. Unit tests
for validation and storage behavior do not require a live database.

## Developer Setup

Install workspace dependencies:

```powershell
corepack pnpm install
```

Start the web app in development mode:

```powershell
corepack pnpm dev
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

