# PaperTrail

PaperTrail is a full-stack AI research assistant for computer science papers.
The planned MVP lets students upload academic PDFs, extract paper text and
metadata, ask citation-grounded questions, compare evidence, and turn cited
answers into reusable research notes.

## Current Status

Thread A, the monorepo foundation, is complete. The repository currently
contains the Next.js app shell, shared workspace configuration, and baseline
lint, typecheck, and test commands.

Database, authentication, PDF ingestion, RAG, and grounded answering are planned
work and are not implemented yet unless they appear in a later merged change.

## Repository Structure

```text
apps/
  web/              Next.js App Router frontend shell
packages/
  config/           Shared ESLint, Prettier, and TypeScript configuration
  shared/           Shared TypeScript utilities and types
  db/               Planned database package for Prisma and database helpers
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

PostgreSQL and pgvector are planned for the MVP database/RAG milestones, but the
current foundation branch does not require a database to run the baseline app
shell.

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

