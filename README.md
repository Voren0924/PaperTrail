# PaperTrail

PaperTrail is now a local-first desktop MVP direction for PDF question answering. The current implementation still runs through the Next.js development shell as a temporary local bridge, but the product flow no longer requires registration, login, logout, teams, organizations, billing, or cloud accounts.

The app lets a single local user import PDFs, parse and chunk them locally, create embeddings through a user-configured OpenAI-compatible provider, and ask citation-grounded questions over the local document library.

## Current Status

- Local-first MVP foundation is in place with SQLite through Prisma.
- Provider settings are saved locally from the Settings screen.
- API keys are user-provided; no production key is bundled.
- Imported PDFs are copied into local app data storage.
- Existing parsing, chunking, embedding, retrieval, grounded answering, and citation UI logic are preserved.
- Next.js API routes remain as thin local wrappers until Tauri commands are added.
- Full Windows executable packaging with Tauri is a follow-up task.

## Repository Structure

```text
apps/
  web/              Next.js local bridge UI, API routes, services, and worker
packages/
  config/           Shared ESLint, Prettier, and TypeScript configuration
  shared/           Shared TypeScript utilities and types
  db/               Prisma schema, migrations, and database helpers
docs/
  DEVELOPMENT_PLAN.md
scripts/
  codex-finish.ps1
```

## Local Data

By default, local development data is stored under:

```text
.data/PaperTrail/
  papertrail.db
  files/
  cache/
  logs/
```

The app data directory can be overridden with `PAPERTRAIL_APP_DATA_DIR`. When `DATABASE_URL` is not set, the runtime creates a default SQLite URL that points at the repo-root `.data/PaperTrail/papertrail.db`, regardless of whether the process was started from the root workspace or `apps/web`.

API keys are currently stored in the local SQLite settings table for this migration pass. Moving the API key into the OS credential store is planned for the Tauri packaging pass. Do not commit real API keys, `.env` files, uploaded PDFs, or `.data`.

## Developer Setup

Install workspace dependencies:

```powershell
corepack pnpm install
```

Create a local `.env.local` or environment from `.env.example` if you want explicit paths:

```text
DATABASE_URL=file:../../../.data/PaperTrail/papertrail.db
PAPERTRAIL_APP_DATA_DIR=.data/PaperTrail
STORAGE_DRIVER=local
MAX_UPLOAD_MB=50
WORKER_POLL_INTERVAL_MS=5000
```

Use an absolute `PAPERTRAIL_APP_DATA_DIR` when setting it manually. Relative values are resolved by the current process, which can differ between Prisma CLI commands and filtered workspace scripts.

Apply the local SQLite migration and generate Prisma:

```powershell
corepack pnpm db:generate
corepack pnpm db:migrate
```

Start the local UI:

```powershell
corepack pnpm dev
```

Run the worker in a second terminal:

```powershell
corepack pnpm worker
```

Open Settings in the app and enter:

- API Base URL
- API Key
- Chat Model
- Embedding Model

The provider must implement OpenAI-compatible `/chat/completions` and `/embeddings` endpoints.

## Using The MVP

1. Open the app.
2. Configure provider settings if prompted.
3. Import a local PDF.
4. Wait for parsing, chunking, and embedding to finish.
5. Open the document and ask a question.
6. Inspect citations with page ranges and source snippets.

## Validation

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

Validate Prisma:

```powershell
$env:DATABASE_URL="file:../../../.data/PaperTrail/papertrail.db"
corepack pnpm --filter @papertrail/db exec prisma validate --schema prisma/schema.prisma
```

## Current Limitations

- The app is not packaged as a Windows executable yet.
- The UI still uses browser file input through the Next.js local bridge; the import service now copies files into app-controlled local storage and is ready for a Tauri file-picker command.
- Embedding search is TypeScript cosine similarity over locally stored vectors, intended for MVP-scale libraries.
- API key storage is local plaintext until OS keychain integration is added.
- Internal model names such as `Paper` remain for compatibility with the existing RAG code.

## Codex Workflow

- Use one branch per task, named `codex/<task-name>`.
- Keep changes scoped to the assigned task.
- At task completion, run:

```powershell
scripts/codex-finish.ps1 -Message "clear commit message"
```

- Push the current `codex/<task-name>` branch.
- Open a pull request targeting `main`.
- Do not merge pull requests automatically.
