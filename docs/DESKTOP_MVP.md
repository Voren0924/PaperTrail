# PaperTrail Desktop MVP

This migration pass changes the MVP direction from web/SaaS to a local-first desktop application.

## Product Definition

PaperTrail Desktop MVP is a local PDF question-answering app:

1. User opens the app.
2. Missing provider settings route the user to Settings.
3. User enters an OpenAI-compatible API base URL, API key, chat model, and embedding model.
4. User imports PDFs from the local computer.
5. PaperTrail copies PDFs into app-controlled local storage.
6. The worker parses pages, chunks text, creates embeddings, and stores local records.
7. User asks questions.
8. Retrieval searches local chunks and embeddings.
9. Grounded answers return citations with page ranges and source snippets.

No registration, login, logout, organizations, teams, workspaces, billing, subscriptions, or cloud accounts are required for the MVP.

## Current Architecture

```text
Next.js local bridge
  UI screens
  Thin API routes
  Local services
  Worker
SQLite database
Local file storage
OpenAI-compatible provider
```

Tauri is the intended desktop shell, but this pass deliberately keeps packaging out of scope and prepares the reusable service layer that Tauri commands should call next.

## Local Persistence

Default development layout:

```text
.data/PaperTrail/
  papertrail.db
  files/
    <documentId>.pdf
  cache/
  logs/
```

The database uses Prisma with SQLite. Embeddings are stored as JSON vectors in the `Embedding` table and ranked locally with cosine similarity.

## Provider Settings

Required settings:

- `providerBaseUrl`
- `providerApiKey`
- `chatModel`
- `embeddingModel`

The Settings API masks the API key in read responses and only returns `hasApiKey`. The key is stored locally in SQLite for now; OS keychain storage remains a follow-up.

## Transitional API Boundary

The following routes remain as local wrappers during the transition:

- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/settings/test`
- `GET /api/papers`
- `POST /api/papers`
- `GET /api/papers/:paperId`
- `DELETE /api/papers/:paperId`
- `POST /api/papers/:paperId/retry`
- `POST /api/chat`

Route handlers should stay thin. Tauri commands should reuse the same services rather than duplicating import, retrieval, or chat logic.

## Follow-Up Tasks

- Add Tauri app shell and Windows build configuration.
- Replace browser file input with Tauri file picker and drag-and-drop.
- Move API key storage into OS credential storage.
- Add a reset-local-data command.
- Add desktop smoke tests once the Tauri shell exists.
