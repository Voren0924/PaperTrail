# PaperTrail Development Plan

## 0. Desktop MVP Direction Update

PaperTrail is no longer a web/SaaS MVP. The active MVP direction is a local-first desktop PDF question-answering app that stores PDFs, parsed text, chunks, embeddings, conversations, and provider settings locally.

This update supersedes older auth, PostgreSQL, pgvector, cloud deployment, and account-oriented notes elsewhere in this historical plan:

- No registration, login, logout, organizations, workspaces, teams, billing, or subscriptions are required for the MVP.
- The app has one implicit local owner identified as `LOCAL_USER_ID = "local"` where compatibility with existing service code still needs an owner value.
- Local persistence uses SQLite through Prisma.
- Embeddings are stored locally in an `Embedding` table as JSON vectors and ranked with TypeScript cosine similarity for MVP-scale libraries.
- Provider settings are entered in the Settings screen and stored locally. User API keys must not be committed or logged.
- Next.js API routes are now a temporary local bridge; Tauri commands should call the same service modules in a later packaging pass.
- See `docs/DESKTOP_MVP.md` for the current architecture and follow-up tasks.

## 1. Project Overview

PaperTrail is a full-stack AI research assistant for computer science papers. It helps students upload academic PDFs, extract structured paper information, ask citation-grounded questions, compare papers, and generate reusable research notes.

The MVP should prove one core workflow end to end:

1. A user uploads one or more CS paper PDFs.
2. The system parses each PDF into text, metadata, sections, chunks, and page-aware citations.
3. The user asks questions about one paper.
4. The system retrieves relevant chunks, answers with citations, and exposes enough evidence for the user to verify the answer.
5. Later milestones extend this into multi-paper comparison and structured notes.

The product must be conservative, inspectable, and maintainable. AI output should never be treated as authoritative without source references.

## 2. Target Users

- CS undergraduate students reading papers for coursework, projects, and seminars.
- CS graduate students doing early-stage literature review.
- Student research assistants who need to summarize and compare papers quickly.
- Instructors or teaching assistants reviewing whether students understood assigned papers.

Primary assumptions:

- Users understand basic academic paper structure but may not know the field deeply.
- Users need citation-grounded answers more than creative prose.
- Users may upload imperfect PDFs, scans, arXiv PDFs, ACM/IEEE-style papers, or camera-generated PDFs.
- Users will review generated notes before using them in assignments or research.

## 3. MVP Scope

The full product is intentionally larger than the first shippable MVP. To keep implementation realistic for one student or a small team, build PaperTrail in milestones.

### Milestone 1: PDF Upload And Paper Detail

Required:

- User can sign in with the chosen MVP auth mechanism.
- User can upload a PDF.
- Original PDF is stored locally.
- Worker extracts page-level text.
- Paper detail page shows parsing status, page count, extracted title when available, abstract when available, and page text preview.
- Failed parsing is visible and retryable.

### Milestone 2: Single-Paper Cited Q&A

Required for MVP:

- Section-aware or page-aware chunking.
- Chunk embeddings stored in pgvector.
- Single-paper question answering.
- Answers grounded only in retrieved chunks.
- Validated citations that open an evidence drawer.
- Basic local RAG evaluation for retrieval hit rate and citation validity.

### Milestone 3: Multi-Paper Q&A

Stretch for MVP, planned after Milestone 2:

- User selects multiple ready papers.
- Retrieval is scoped to selected paper IDs.
- Answers compare or synthesize across selected papers with citations.

### Milestone 4: Notes And Compare

Post-MVP unless Milestones 1-2 are stable:

- Paper comparison view for 2-5 papers.
- Research note generation from selected cited evidence.
- Editable notes with citation sidebar.

### Milestone 5: Evaluation And Polish

Ongoing after the first working vertical slice:

- Broader PDF fixtures.
- Playwright smoke tests.
- Improved parser heuristics.
- Better empty, loading, error, and retry states.

MVP required scope is Milestones 1-2 only. Milestones 3-5 are documented so the architecture does not block them, but they must not be treated as required acceptance criteria for the first MVP.

MVP quality bar:

- The app should work reliably for born-digital CS PDFs.
- Scanned PDFs may be detected and marked unsupported or low-confidence.
- All AI answers must show citations and quote/evidence previews.
- Parsing failures must be visible and recoverable by retrying.
- The system should prefer a clear unsupported state over silently producing low-quality RAG results.

## 4. Non-Goals For MVP

Do not include these in the MVP:

- Real-time collaborative editing.
- Browser extension.
- Mobile-native app.
- Full citation manager replacement.
- BibTeX/Zotero/Mendeley sync.
- Automatic paper discovery from the web.
- Fine-tuning custom models.
- Full OCR pipeline for scanned PDFs.
- Cross-user sharing, teams, or organizations.
- Payment, billing, plans, or quotas beyond simple local limits.
- Advanced graph visualization of citations.
- Claim verification against the broader internet.
- Production-grade institutional SSO.
- Complex agentic workflows that modify the user library without confirmation.
- Required multi-paper Q&A.
- Required compare workflow.
- Required note generation workflow.
- Full production auth/security certification. MVP auth must still be implemented coherently and safely for local development, but the app should make no production security claims until reviewed.

## 5. Technical Stack

Use a conservative TypeScript-first stack:

- Monorepo: pnpm workspaces.
- Frontend: Next.js App Router, React, TypeScript.
- Styling: Tailwind CSS plus a small local component layer.
- Backend API: Next.js route handlers for MVP, with service modules separated from HTTP handlers.
- Database: PostgreSQL.
- ORM: Prisma.
- Vector search: pgvector in PostgreSQL.
- Object/file storage:
  - Local filesystem storage for development.
  - S3-compatible abstraction for future production.
- PDF parsing:
  - Primary: `pdf-parse` or `pdfjs-dist` for text and page extraction.
  - Thread E implementation uses `pdf-parse` for TypeScript-friendly page text extraction in the worker.
  - Optional later: GROBID for metadata/reference extraction if needed.
- Background jobs:
  - MVP: simple database-backed job records and a worker process.
  - Avoid introducing Redis or a distributed queue until required.
- LLM provider abstraction:
  - OpenAI-compatible service interface.
  - Keep model names in environment configuration.
- Testing:
  - Unit: Vitest.
  - API/service integration: Vitest with test database.
  - Frontend component tests: React Testing Library where useful.
  - End-to-end smoke tests: Playwright.
- Linting/formatting:
  - ESLint.
  - Prettier.
  - TypeScript strict mode.

Auth decision for MVP:

- Use secure HTTP-only cookie sessions backed by a database `Session` table.
- Do not use JWT for browser auth unless this plan is explicitly updated.
- Hash passwords with Argon2id if practical; bcrypt is acceptable if Argon2id creates deployment friction.
- CSRF protection must be handled for state-changing browser requests, either through same-site cookies plus framework-supported safeguards or an explicit CSRF token.
- `logout` invalidates the server-side session record and clears the cookie.
- API routes obtain the current user through one shared server helper. Do not create parallel auth helpers in feature modules.
- Development auth and future production auth should use the same API shape. If a shortcut is needed for local development, it must be isolated behind an environment flag and must not bypass ownership checks.

Recommended repository shape:

```text
PaperTrail/
  apps/
    web/
  packages/
    config/
    db/
    shared/
  docs/
  scripts/
```

## 6. System Architecture

PaperTrail should be built as a modular monolith for the MVP.

Core modules:

- Web UI: renders library, paper detail, chat, compare, notes, and settings pages.
- API layer: validates requests, handles auth, maps HTTP errors, and delegates to services.
- Auth service: identifies the current user and enforces ownership checks.
- Paper service: owns paper records, upload lifecycle, parse status, and metadata updates.
- Storage service: stores and retrieves PDF files and derived artifacts.
- Parsing service: extracts pages, sections, references, and metadata candidates.
- Chunking service: converts page text into citation-aware chunks.
- Embedding service: creates vector embeddings for chunks.
- Retrieval service: finds relevant chunks for a question and selected paper scope.
- Answer service: builds grounded prompts and validates citation references.
- Notes service: generates and stores research notes.
- Evaluation service: runs curated test questions and retrieval checks.
- Worker: processes asynchronous parse, chunk, embed, and extraction jobs.

High-level architecture:

```text
Browser
  |
  | HTTPS / local dev HTTP
  v
Next.js Web App
  |
  | Route handlers call service modules
  v
Application Services
  |            |              |
  |            |              v
  |            |         File Storage
  |            v
  |       LLM Provider
  v
PostgreSQL + pgvector
  ^
  |
Worker Process
```

Important boundaries:

- Route handlers must stay thin.
- Service modules must not import React or UI code.
- Database access should go through Prisma client helpers.
- LLM calls must go through one provider abstraction.
- Parsing and retrieval should be testable without starting the web server.

## 7. Data Flow

### Upload And Ingestion

1. User uploads a PDF from the web app.
2. API validates file type, file size, and user ownership.
3. Storage service writes the original PDF.
4. Paper record is created with status `UPLOADED`.
5. A `PARSE_PAPER` job is created.
6. Worker reads the PDF and extracts page-level text.
7. Parser stores `PaperPage` records and metadata candidates.
8. Chunker creates `PaperChunk` records with page ranges and section labels.
9. Embedding service embeds chunks and stores vectors.
10. Paper status becomes `READY`, or `FAILED` with a visible error.

### Question Answering

1. User asks a question in the paper detail chat or collection chat.
2. API validates selected paper scope and ownership.
3. Retrieval service embeds the query.
4. Retrieval service searches `PaperChunk` by vector similarity and filters by selected paper IDs.
5. Optional reranking sorts candidates by relevance, recency in context, and citation usefulness.
6. Answer service sends the question and selected chunks to the LLM.
7. LLM must answer only from supplied context and return structured `answer` plus `citedClaims`.
8. Backend validates that returned citation IDs exist in the retrieved context.
9. Backend derives quote previews from stored chunks.
10. Answer, cited claims, citations, and retrieval metadata are stored with the `ChatMessage`.
11. Frontend renders answer, citation chips, and evidence previews.

### Notes Post-MVP

1. User selects one paper, multiple papers, or chat answers.
2. Notes service retrieves cited chunks and paper metadata.
3. LLM generates a structured note with citations.
4. Note is stored and editable in the UI.

## 8. Database Schema Proposal

Use UUID primary keys. Include `createdAt` and `updatedAt` on all mutable tables. Use soft deletion only where user-facing recovery is required; otherwise prefer explicit deletes with ownership checks.

### User

- `id`: UUID primary key.
- `email`: unique string.
- `name`: nullable string.
- `passwordHash`: nullable string for email/password auth.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

### Session

- `id`: UUID primary key.
- `userId`: foreign key to `User`.
- `sessionTokenHash`: unique string. Store only a hash of the browser cookie token.
- `expiresAt`: timestamp.
- `createdAt`: timestamp.
- `lastUsedAt`: nullable timestamp.
- `revokedAt`: nullable timestamp.

Indexes:

- `(userId, expiresAt)`
- `(expiresAt)`

### Paper

- `id`: UUID primary key.
- `userId`: foreign key to `User`.
- `title`: nullable string.
- `abstract`: nullable text.
- `publicationYear`: nullable integer.
- `venue`: nullable string.
- `doi`: nullable string.
- `sourceUrl`: nullable string.
- `originalFileName`: string.
- `storageKey`: string.
- `fileSha256`: string.
- `pageCount`: nullable integer.
- `status`: enum: `UPLOADED`, `PARSING`, `EMBEDDING`, `READY`, `FAILED`.
- `statusMessage`: nullable string.
- `metadataConfidence`: nullable float.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Indexes:

- `(userId, createdAt)`
- `(userId, status)`
- `(fileSha256)`

### PaperAuthor

- `id`: UUID primary key.
- `paperId`: foreign key to `Paper`.
- `name`: string.
- `position`: integer.

Index:

- `(paperId, position)`

### PaperPage

- `id`: UUID primary key.
- `paperId`: foreign key to `Paper`.
- `pageNumber`: integer, 1-based.
- `text`: text.
- `charCount`: integer.
- `createdAt`: timestamp.

Unique index:

- `(paperId, pageNumber)`

### PaperSection

- `id`: UUID primary key.
- `paperId`: foreign key to `Paper`.
- `title`: string.
- `normalizedTitle`: string.
- `startPage`: nullable integer.
- `endPage`: nullable integer.
- `position`: integer.

Index:

- `(paperId, position)`

### PaperChunk

- `id`: UUID primary key.
- `paperId`: foreign key to `Paper`.
- `sectionId`: nullable foreign key to `PaperSection`.
- `chunkIndex`: integer.
- `text`: text.
- `tokenCount`: integer.
- `startPage`: integer.
- `endPage`: integer.
- `charStart`: nullable integer. Character offset in the concatenated normalized paper text.
- `charEnd`: nullable integer. Character offset in the concatenated normalized paper text.
- `pageTextOffsets`: nullable JSON. Maps page numbers to local start/end offsets for citation debugging.
- `contentHash`: string. Hash of normalized chunk text.
- `chunkVersion`: integer. Increment when chunking rules change.
- `embedding`: vector column.
- `embeddingModel`: string.
- `createdAt`: timestamp.

Indexes:

- `(paperId, chunkIndex)`
- `(paperId, chunkVersion)`
- `(paperId, contentHash)`
- vector index on `embedding`

### PaperReference

- `id`: UUID primary key.
- `paperId`: foreign key to `Paper`.
- `rawText`: text.
- `title`: nullable string.
- `authorsText`: nullable text.
- `year`: nullable integer.
- `venue`: nullable string.
- `doi`: nullable string.
- `position`: integer.

Index:

- `(paperId, position)`

### ChatSession

- `id`: UUID primary key.
- `userId`: foreign key to `User`.
- `title`: nullable string.
- `scopeType`: enum: `PAPER`, `COLLECTION`.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

### ChatSessionPaper

- `id`: UUID primary key.
- `chatSessionId`: foreign key to `ChatSession`.
- `paperId`: foreign key to `Paper`.

Unique index:

- `(chatSessionId, paperId)`

### ChatMessage

- `id`: UUID primary key.
- `chatSessionId`: foreign key to `ChatSession`.
- `role`: enum: `USER`, `ASSISTANT`, `SYSTEM`.
- `status`: enum: `PENDING`, `SUCCEEDED`, `FAILED`.
- `content`: text.
- `model`: nullable string.
- `promptVersion`: nullable string.
- `temperature`: nullable float.
- `retrievalMetadata`: nullable JSON. Store retrieved chunk IDs, scores, selected paper IDs, and final context chunk IDs.
- `providerRequestId`: nullable string.
- `llmTraceId`: nullable string.
- `errorCode`: nullable string.
- `createdAt`: timestamp.

Index:

- `(chatSessionId, createdAt)`

### ChatCitation

- `id`: UUID primary key.
- `chatMessageId`: foreign key to `ChatMessage`.
- `paperId`: foreign key to `Paper`.
- `chunkId`: foreign key to `PaperChunk`.
- `pageStart`: integer.
- `pageEnd`: integer.
- `quote`: nullable text.
- `label`: string, for example `[Smith 2024, p. 3]`.

Index:

- `(chatMessageId)`

### ChatCitedClaim

- `id`: UUID primary key.
- `chatMessageId`: foreign key to `ChatMessage`.
- `claimText`: text. One factual claim extracted from the assistant answer.
- `citationIds`: JSON array of `ChatCitation.id` values supporting the claim.
- `position`: integer.

Index:

- `(chatMessageId, position)`

### ResearchNote

- `id`: UUID primary key.
- `userId`: foreign key to `User`.
- `title`: string.
- `contentMarkdown`: text.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

### ResearchNoteCitation

- `id`: UUID primary key.
- `researchNoteId`: foreign key to `ResearchNote`.
- `paperId`: foreign key to `Paper`.
- `chunkId`: nullable foreign key to `PaperChunk`.
- `pageStart`: integer.
- `pageEnd`: integer.
- `quote`: nullable text.

### Job

- `id`: UUID primary key.
- `type`: enum: `PARSE_PAPER`, `EMBED_PAPER`, `RETRY_PAPER`.
- `status`: enum: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`.
- `paperId`: nullable foreign key to `Paper`.
- `payload`: JSON. Store job-specific input such as paper ID, parser version, or chunk version.
- `attempts`: integer.
- `maxAttempts`: integer.
- `errorMessage`: nullable text.
- `lockedAt`: nullable timestamp.
- `lockedBy`: nullable string.
- `runAfter`: timestamp.
- `lastHeartbeatAt`: nullable timestamp.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.
- `startedAt`: nullable timestamp.
- `finishedAt`: nullable timestamp.

Index:

- `(status, createdAt)`
- `(status, runAfter)`
- `(lockedAt)`

## 9. API Contract

All API responses should use JSON. Errors should follow one consistent shape:

```json
{
  "error": {
    "code": "PAPER_NOT_READY",
    "message": "Paper is still being processed.",
    "details": {}
  }
}
```

API conventions:

- `200`: successful read or mutation with response body.
- `201`: resource created.
- `202`: asynchronous work accepted, such as retrying parsing.
- `204`: successful delete with no response body, unless the endpoint returns `{ "ok": true }` for consistency.
- `400`: malformed JSON, invalid multipart request, or unsupported parameters.
- `401`: unauthenticated.
- `403`: authenticated but not allowed to access the resource.
- `404`: resource does not exist or does not belong to the user.
- `409`: resource state conflict, such as chat against a paper that is not ready.
- `413`: upload exceeds `MAX_UPLOAD_MB`.
- `422`: validation failed with field-level details.
- `429`: local rate or usage limit exceeded.
- `500`: unexpected server error.

Pagination:

- List endpoints must support `limit` and `cursor` once result sets can grow.
- Default `limit` should be 20.
- Maximum `limit` should be 100.
- Responses should include `nextCursor` when more results are available.

Sorting:

- Paper list default sort is newest first.
- Supported paper sort keys for MVP: `createdAt`, `title`, `status`.
- Unsupported sort keys return `422`.

Validation error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "fields": {
        "file": "PDF file is required."
      }
    }
  }
}
```

Auth error shape:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Sign in is required.",
    "details": {}
  }
}
```

Paper not ready error shape:

```json
{
  "error": {
    "code": "PAPER_NOT_READY",
    "message": "Paper is still being processed.",
    "details": {
      "paperId": "uuid",
      "status": "PARSING"
    }
  }
}
```

Upload limit error shape:

```json
{
  "error": {
    "code": "UPLOAD_TOO_LARGE",
    "message": "PDF exceeds the configured upload size limit.",
    "details": {
      "maxUploadMb": 50
    }
  }
}
```

Chat streaming decision:

- MVP chat is non-streaming for simplicity and reliable citation validation.
- Streaming may be added later only with an explicit event contract such as `text_delta`, `citation_delta`, `error`, and `final_message`.
- If streaming is added, citations must still be validated before the final assistant message is persisted as succeeded.

Retry idempotency:

- `POST /api/papers/:paperId/retry` should not enqueue duplicate active jobs for the same paper.
- If a retry job is already `QUEUED` or `RUNNING`, return the existing job with `200`.
- If a new retry job is created, return `202`.

### Auth

`POST /api/auth/register`

Request:

```json
{
  "email": "student@example.com",
  "password": "password",
  "name": "Student Name"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "name": "Student Name"
  }
}
```

`POST /api/auth/login`

Request:

```json
{
  "email": "student@example.com",
  "password": "password"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "name": "Student Name"
  }
}
```

`POST /api/auth/logout`

Response:

```json
{
  "ok": true
}
```

`GET /api/me`

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "name": "Student Name"
  }
}
```

### Papers

`POST /api/papers`

Multipart form fields:

- `file`: PDF file.

Response:

```json
{
  "paper": {
    "id": "uuid",
    "originalFileName": "paper.pdf",
    "status": "UPLOADED"
  }
}
```

`GET /api/papers`

Query parameters:

- `status`: optional paper status.
- `q`: optional search query over title, authors, and abstract.
- `limit`: optional page size, default 20.
- `cursor`: optional pagination cursor.
- `sort`: optional sort key: `createdAt`, `title`, or `status`.

Response:

```json
{
  "papers": [
    {
      "id": "uuid",
      "title": "Attention Is All You Need",
      "authors": ["Ashish Vaswani"],
      "publicationYear": 2017,
      "venue": "NeurIPS",
      "status": "READY",
      "pageCount": 15,
      "createdAt": "2026-05-18T00:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

`GET /api/papers/:paperId`

Response:

```json
{
  "paper": {
    "id": "uuid",
    "title": "Paper Title",
    "authors": ["Author One", "Author Two"],
    "abstract": "Abstract text",
    "publicationYear": 2024,
    "venue": "Conference",
    "status": "READY",
    "statusMessage": null,
    "sections": [
      {
        "id": "uuid",
        "title": "Introduction",
        "startPage": 1,
        "endPage": 2
      }
    ]
  }
}
```

`DELETE /api/papers/:paperId`

Response:

```json
{
  "ok": true
}
```

`POST /api/papers/:paperId/retry`

Response:

```json
{
  "job": {
    "id": "uuid",
    "status": "QUEUED"
  }
}
```

### Chat

`POST /api/chat-sessions`

Request:

```json
{
  "paperIds": ["uuid"],
  "title": "Transformer paper questions"
}
```

Response:

```json
{
  "chatSession": {
    "id": "uuid",
    "scopeType": "PAPER",
    "paperIds": ["uuid"],
    "title": "Transformer paper questions"
  }
}
```

`GET /api/chat-sessions/:chatSessionId/messages`

Response:

```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "USER",
      "content": "What is the main contribution?",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "citations": []
    },
    {
      "id": "uuid",
      "role": "ASSISTANT",
      "content": "The main contribution is ...",
      "createdAt": "2026-05-18T00:00:01.000Z",
      "citations": [
        {
          "paperId": "uuid",
          "chunkId": "uuid",
          "label": "[Paper Title, p. 2]",
          "pageStart": 2,
          "pageEnd": 2,
          "quote": "Relevant evidence"
        }
      ]
    }
  ]
}
```

`POST /api/chat-sessions/:chatSessionId/messages`

Request:

```json
{
  "content": "What problem does this paper solve?"
}
```

Response:

```json
{
  "message": {
    "id": "uuid",
    "role": "ASSISTANT",
    "content": "Answer grounded in citations.",
    "citations": [
      {
        "paperId": "uuid",
        "chunkId": "uuid",
        "label": "[Paper Title, p. 3]",
        "pageStart": 3,
        "pageEnd": 3,
        "quote": "Evidence quote"
      }
    ],
    "citedClaims": [
      {
        "claimText": "One factual claim from the answer.",
        "citationLabels": ["[Paper Title, p. 3]"]
      }
    ]
  }
}
```

### Compare Post-MVP

`POST /api/compare`

This endpoint is planned for Milestone 4. Do not implement it before the single-paper cited Q&A flow is stable.

Request:

```json
{
  "paperIds": ["uuid", "uuid"],
  "focus": "methodology and evaluation"
}
```

Response:

```json
{
  "comparison": {
    "summary": "Comparison text.",
    "dimensions": [
      {
        "name": "Method",
        "paperFindings": [
          {
            "paperId": "uuid",
            "text": "Finding with citation.",
            "citations": ["citation-id"]
          }
        ]
      }
    ],
    "citations": [
      {
        "id": "citation-id",
        "paperId": "uuid",
        "chunkId": "uuid",
        "label": "[Paper Title, p. 5]",
        "quote": "Evidence quote"
      }
    ]
  }
}
```

### Notes Post-MVP

`POST /api/notes`

These endpoints are planned for Milestone 4. Do not implement them before the single-paper cited Q&A flow is stable.

Request:

```json
{
  "title": "Research note",
  "paperIds": ["uuid"],
  "sourceChatMessageIds": ["uuid"],
  "instructions": "Focus on limitations and future work."
}
```

Response:

```json
{
  "note": {
    "id": "uuid",
    "title": "Research note",
    "contentMarkdown": "# Research note\n\n..."
  }
}
```

`GET /api/notes`

Response:

```json
{
  "notes": [
    {
      "id": "uuid",
      "title": "Research note",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "updatedAt": "2026-05-18T00:00:00.000Z"
    }
  ]
}
```

`GET /api/notes/:noteId`

Response:

```json
{
  "note": {
    "id": "uuid",
    "title": "Research note",
    "contentMarkdown": "# Research note\n\n...",
    "citations": []
  }
}
```

`PATCH /api/notes/:noteId`

Request:

```json
{
  "title": "Updated title",
  "contentMarkdown": "Updated markdown"
}
```

Response:

```json
{
  "note": {
    "id": "uuid",
    "title": "Updated title",
    "contentMarkdown": "Updated markdown"
  }
}
```

## 10. Frontend Page Structure

Use task-oriented application pages, not a marketing site.

Recommended routes:

- `/login`: sign in form.
- `/register`: registration form.
- `/library`: paper library with upload control, status filters, and search.
- `/papers/[paperId]`: paper detail, metadata, sections, parsing status, and single-paper chat.
- `/compare`: selected paper comparison workspace. Stretch after MVP.
- `/notes`: notes list. Stretch after MVP.
- `/notes/[noteId]`: note editor with citation panel. Stretch after MVP.
- `/settings`: account and model/provider settings for development.

Core UI components:

- `AppShell`: navigation, account menu, main content region.
- `PaperUploadButton`: validates file before upload and shows progress.
- `PaperStatusBadge`: consistent parse state display.
- `PaperList`: searchable list with empty, loading, and error states.
- `PaperMetadataPanel`: title, authors, abstract, venue, year, sections.
- `ChatPanel`: messages, input, loading state, and retry affordance.
- `CitationChip`: compact citation label that opens evidence preview.
- `EvidenceDrawer`: cited quote, page range, chunk text, paper metadata.
- `CompareMatrix`: rows for comparison dimensions and columns for papers. Stretch after MVP.
- `NoteEditor`: markdown editor plus citation sidebar. Stretch after MVP.

Frontend rules:

- Keep page state simple. Prefer server-loaded data plus small client components for interactive controls.
- Never hide citation evidence behind only hover states; clickable access is required.
- Show parse status prominently when a paper is not ready.
- Disable chat and compare actions for papers that are not `READY`.
- Always include empty states with concrete next actions.

## 11. Backend Service Structure

Recommended layout under `apps/web/src` and packages:

```text
apps/web/src/
  app/
    api/
    library/
    papers/
    compare/
    notes/
  components/
  server/
    auth/
    errors/
    services/
      paperService.ts
      storageService.ts
      parsingService.ts
      chunkingService.ts
      embeddingService.ts
      retrievalService.ts
      answerService.ts
      noteService.ts
      evaluationService.ts
    workers/
      worker.ts
      jobRunner.ts
packages/
  db/
    prisma/
    src/
  shared/
    src/
      types/
      validation/
```

Service responsibilities:

- `paperService`: paper CRUD, ownership checks, status transitions.
- `storageService`: save, fetch, and delete original PDFs and derived artifacts.
- `parsingService`: PDF text extraction, metadata candidates, references, page records.
- `chunkingService`: section-aware chunk creation.
- `embeddingService`: embedding model calls, batching, retry handling.
- `retrievalService`: query embedding, vector search, result filtering.
- `answerService`: grounded prompt construction, LLM calls, citation validation.
- `noteService`: note CRUD and note generation.
- `evaluationService`: run fixture questions and report metrics.
- `jobRunner`: locks queued jobs, executes handlers, records failures.

Backend rules:

- API route handlers validate input and call services.
- Services throw typed application errors.
- Services must enforce user ownership before returning or mutating records.
- Long-running PDF parsing and embedding must happen in the worker, not inside request handlers.
- LLM provider details must not leak into route handlers or React components.

## 12. RAG Pipeline Design

The MVP RAG pipeline should prioritize traceability over broad recall.

Pipeline:

1. Normalize the user question.
2. Embed the question using configured embedding model.
3. Filter candidate chunks by selected paper IDs and user ownership.
4. Retrieve top 20 vector matches.
5. Apply lightweight post-filtering:
   - remove near-duplicate chunks
   - prefer chunks with section labels
   - keep page diversity where possible
6. Select top 6-10 chunks for answer context.
7. Ask the LLM to answer using only supplied chunks.
8. Require structured `answer` and `citedClaims` references to supplied chunk IDs.
9. Validate citations server-side.
10. Derive quote previews from stored chunk text.
11. Store answer, cited claims, citations, and retrieval metadata.

Prompt constraints:

- The model must say when the supplied context is insufficient.
- The model must not cite chunks it was not given.
- The model must not invent bibliographic details.
- The model should distinguish paper claims from its own synthesis.

Retrieval metadata to log for debugging:

- query text
- selected paper IDs
- embedding model
- retrieved chunk IDs
- similarity scores
- final chunks sent to LLM
- generated citation IDs

## 13. PDF Parsing And Chunking Strategy

### Parsing

MVP parsing should be deterministic and debuggable:

- Extract text page by page.
- Preserve 1-based page numbers.
- Store raw page text before higher-level processing.
- Detect likely scanned PDFs by low text density.
- Extract title and authors using first-page heuristics plus optional LLM cleanup.
- Extract abstract by locating an `Abstract` heading when possible.
- Extract section headings using line-level heuristics:
  - numbered headings such as `1 Introduction`
  - common CS headings such as `Method`, `Experiments`, `Evaluation`, `Related Work`, `Conclusion`
- Extract references by locating `References` or `Bibliography` section.

Parsing output should include confidence flags. Do not block paper readiness just because title, authors, venue, or references are imperfect.

Parsing quality gates:

- Calculate per-page character density. Pages with very low extracted text density should be flagged as likely scanned or extraction-failed.
- If most pages are below the configured density threshold, mark the paper `FAILED` or `READY_WITH_WARNINGS` if that status is added later; do not silently continue into RAG.
- Run a basic text-order sanity check for multi-column PDFs. If extraction produces repeated single-character lines, obvious column interleaving, or severe ordering artifacts, store a parser warning.
- Remove repeated headers and footers when the same normalized line appears on many pages.
- Apply conservative dehyphenation for line-end hyphen breaks, but do not rewrite technical tokens aggressively.
- Normalize ligatures where practical, for example `fi` and `fl` ligatures.
- Preserve figure and table captions as normal text when they are extractable.
- Exclude references from default QA chunks unless the user asks about references, related work bibliography, or citation metadata.
- Store parser warnings in paper status metadata or a future `PaperParseDiagnostic` table if warnings become complex.

Minimum acceptable MVP parser output:

- For a born-digital CS paper, most non-reference pages should have non-empty text.
- Page numbers on chunks must match the source page range.
- The abstract should be extracted when a clear `Abstract` heading exists.
- The paper may be marked ready even if venue/year/reference metadata is missing.
- The paper must not become ready for Q&A if no meaningful chunks can be produced.

### Chunking

Chunking requirements:

- Target chunk size: 500-900 tokens.
- Overlap: 80-120 tokens.
- Never merge text across papers.
- Prefer section boundaries when available.
- Preserve start page and end page for every chunk.
- Include section title in chunk metadata but avoid duplicating it excessively in text.
- Skip chunks with very low information content, such as page headers or isolated references, unless needed for references extraction.
- Store content hashes and chunk versions so old citations can be debugged after chunking rules change.

Chunk text shape passed to the LLM:

```text
Chunk ID: <chunkId>
Paper: <title or original filename>
Pages: <startPage>-<endPage>
Section: <section title or Unknown>
Text:
<chunk text>
```

## 14. Citation-Grounding Strategy

Citation grounding is a product requirement, not a UI decoration.

Rules:

- Every assistant answer about paper content must include at least one citation unless it explicitly says the context is insufficient.
- Citations must point to stored `PaperChunk` records.
- Citation labels should be generated by the backend from paper metadata and page numbers.
- The LLM may choose chunk IDs from the supplied context, but the backend must validate them.
- The LLM must return structured output with `answer` and `citedClaims`.
- Each cited claim must bind a factual claim from the answer to one or more supplied chunk IDs.
- If the LLM returns no valid citations for a factual answer, the backend should retry once with stricter instructions.
- If retry fails, return a controlled error or an answer that states insufficient grounded evidence.
- The backend should derive quote previews from stored chunk text. Do not trust LLM-generated quotes.
- Citation validation proves that a citation is legal, not that the answer is fully supported. The cited-claim structure is required so reviewers and future evaluation code can inspect support claim by claim.

Evidence display:

- Show citation label in the answer.
- On click, show quote, full chunk text, page range, paper title, and section.
- Quote should be a short extract from the cited chunk.
- The quote must be derived from stored chunk text, not newly invented by the LLM.
- The evidence drawer must show the raw chunk text, not only a quote preview.

Known limitation:

- MVP citations are page and chunk based, not exact PDF bounding boxes.

## 15. Evaluation Plan

Create a small local evaluation set before broad feature work.

Evaluation fixtures:

- 3-5 representative CS PDFs committed only if licensing allows, otherwise documented as manually supplied test files.
- 5-10 questions per paper:
  - main contribution
  - method
  - dataset or benchmark
  - limitations
  - comparison with prior work
  - future work
- Expected answer notes and expected citation pages.

Metrics:

- Parse success rate.
- Chunk creation count per paper.
- Retrieval hit rate: whether expected page appears in top 10 chunks.
- Citation validity rate: percentage of answer citations that map to supplied chunks.
- Grounded answer rate: percentage of factual answers with at least one valid citation.
- Refusal quality: whether the system says insufficient context for unanswerable questions.

Evaluation command target:

- Future implementation should expose a script such as `pnpm eval:rag`.
- Output should be human-readable JSON or Markdown with failures highlighted.

Manual review checklist:

- Does the answer match cited evidence?
- Are citations specific enough to verify?
- Does the model avoid unsupported claims?
- Are comparison outputs fair to all selected papers?

## 16. Testing Strategy

Testing should match risk:

- Unit tests for parsing helpers, chunking, citation validation, and API validation schemas.
- Service integration tests for paper lifecycle, chat flow, note creation, and ownership checks.
- Worker tests for job status transitions and retry behavior.
- Database tests for schema constraints and vector-search integration where feasible.
- Frontend tests for key states:
  - library empty state
  - upload progress
  - paper not ready
  - chat answer with citations
  - citation drawer
  - compare matrix after compare moves into active scope
- Playwright smoke tests:
  - register or log in
  - upload fixture PDF
  - wait for ready state
  - ask a question
  - open citation evidence
  - create a note after notes move into active scope

Required test data:

- A short born-digital PDF with clear sections.
- A PDF with weak metadata.
- A scanned or low-text PDF to verify unsupported handling.

CI expectations:

- Type check must pass.
- Lint must pass.
- Unit tests must pass.
- E2E tests may be optional locally until stable fixtures exist.

## 17. Local Development Setup

Expected prerequisites:

- Node.js LTS.
- pnpm.
- Docker Desktop or local PostgreSQL.
- PostgreSQL with pgvector enabled.
- An LLM API key configured in `.env.local`.

Planned environment variables:

```text
DATABASE_URL=
AUTH_SECRET=
APP_BASE_URL=http://localhost:3000
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=.data/uploads
LLM_PROVIDER=openai-compatible
LLM_API_KEY=
LLM_BASE_URL=
LLM_CHAT_MODEL=
LLM_EMBEDDING_MODEL=
MAX_UPLOAD_MB=50
```

Planned commands:

```text
pnpm install
pnpm db:migrate
pnpm dev
pnpm worker
pnpm test
pnpm lint
pnpm typecheck
```

Local development behavior:

- Uploaded files go under `.data/uploads`, which must be gitignored.
- Development auth must use the same cookie-session interface as the app. Any dev shortcut must be guarded by an environment flag and must not bypass ownership checks.
- Worker can run as a separate process during development.
- Seed scripts should create only safe demo data and must not require external paper downloads.

## 18. Coding Rules For Future Codex Agents

Future Codex agents must follow these rules:

- Do not implement features outside the assigned scope.
- Read this document before making architectural changes.
- Keep route handlers thin; place business logic in service modules.
- Use TypeScript strict mode and avoid `any` unless justified locally.
- Validate every API input with a shared schema.
- Enforce user ownership in services, not only in UI.
- Do not call LLM providers directly from React components or route handlers.
- Do not store raw API keys or secrets in source files.
- Do not commit uploaded PDFs unless they are explicit test fixtures with acceptable licensing.
- Do not introduce Redis, queues, alternate ORMs, or alternate vector databases for MVP without updating this plan and explaining the tradeoff.
- Do not add broad abstractions before at least two real call sites need them.
- Keep prompts versioned in backend files and covered by basic tests where possible.
- Treat AI output as untrusted. Validate structured outputs before storing.
- Preserve citation IDs and evidence through backend responses.
- Add or update tests when changing parsing, retrieval, citation validation, auth, or ownership logic.
- Avoid unrelated formatting churn.
- If modifying shared contracts, update frontend, backend, tests, and this document in the same change.

## 19. Task Breakdown For Parallel Codex Threads

Parallel work should use clear ownership boundaries. Threads must not edit each other's files without coordination.

Recommended dependency order:

1. Thread A: Monorepo Foundation.
2. Thread B: Database And Prisma.
3. Thread C: Auth And API Foundation.
4. Thread D: Paper Upload And Storage.
5. Thread E: Worker, PDF Parsing, And Chunking.
6. Thread F: Embeddings And Retrieval.
7. Thread G: Grounded Answering And Chat API.
8. Thread H: Frontend Application UI, with early UI limited to upload, paper detail, status, chat, and citation drawer.
9. Thread J: Evaluation, QA, And Documentation should start once parsing and retrieval interfaces exist, then continue throughout.
10. Thread I: Notes And Comparison starts only after Milestone 2 is stable.

Do not run all threads at once. Frontend work can begin early with mocked contracts, but broad UI implementation before API and schema stabilization is expected to cause rework.

### Thread A: Monorepo Foundation

Ownership:

- root package files
- workspace configuration
- TypeScript, ESLint, Prettier config
- base Next.js app creation

Deliverables:

- pnpm workspace.
- Next.js app shell.
- shared config package.
- baseline lint/typecheck/test commands.

Boundaries:

- Do not implement paper parsing, RAG, or database models beyond placeholders needed for build.

### Thread B: Database And Prisma

Ownership:

- `packages/db`
- Prisma schema and migrations
- database client helper
- seed script

Deliverables:

- schema matching this plan.
- pgvector setup documented.
- migration scripts.
- basic database tests.

Boundaries:

- Do not build UI pages.
- Do not call LLM services.

### Thread C: Auth And API Foundation

Ownership:

- auth service
- API error handling
- request validation utilities
- session/current-user helpers

Deliverables:

- register, login, logout, current user API.
- typed error response shape.
- ownership-check helper.

Boundaries:

- Do not implement paper ingestion internals.
- Coordinate shared types with Thread B.

### Thread D: Paper Upload And Storage

Ownership:

- paper upload API
- storage service
- paper library service methods
- local file storage

Deliverables:

- upload endpoint.
- paper list/detail/delete/retry endpoints.
- file validation.
- local storage abstraction.

Boundaries:

- Do not implement PDF parsing beyond enqueueing jobs.
- Do not edit RAG services.

### Thread E: Worker, PDF Parsing, And Chunking

Ownership:

- worker process
- job runner
- parsing service
- chunking service
- parser tests and fixtures

Deliverables:

- page-level text extraction.
- metadata candidate extraction.
- section and reference extraction heuristics.
- chunk records with page ranges.
- failed/ready status handling.

Boundaries:

- Do not implement chat UI or note UI.
- Do not change auth contracts.

### Thread F: Embeddings And Retrieval

Ownership:

- embedding service
- retrieval service
- pgvector query implementation
- retrieval evaluation fixtures

Deliverables:

- batch chunk embedding.
- query embedding.
- top-k scoped retrieval by paper IDs.
- retrieval logging.
- retrieval unit/integration tests.

Boundaries:

- Do not implement answer generation UI.
- Do not alter parser behavior except through documented interfaces.

### Thread G: Grounded Answering And Chat API

Ownership:

- answer service
- chat session API
- message API
- citation validation
- prompt templates

Deliverables:

- single-paper chat for MVP.
- multi-paper chat after Milestone 2 is stable.
- valid citation storage.
- retry-on-invalid-citations behavior.
- tests for grounded answer failure modes.

Boundaries:

- Do not build frontend pages except API consumers if explicitly coordinated.
- Do not change database schema without Thread B coordination.

### Thread H: Frontend Application UI

Ownership:

- app shell
- library page
- paper detail page
- chat panel
- citation drawer
- compare page after Milestone 2
- notes pages after Milestone 2

Deliverables:

- user-facing MVP workflow for upload, paper detail, single-paper chat, and citation evidence.
- loading, error, empty, and not-ready states.
- citation evidence interactions.

Boundaries:

- Consume API contracts from this document.
- Do not add backend business logic in UI components.

### Thread I: Notes And Comparison

Ownership:

- comparison service/API
- note service/API
- note generation prompts
- compare and note backend tests

Deliverables:

- compare endpoint for 2-5 papers.
- note creation from papers or cited chat messages.
- note CRUD.

Boundaries:

- Coordinate UI integration with Thread H.
- Reuse retrieval and answer services; do not duplicate RAG logic.

### Thread J: Evaluation, QA, And Documentation

Ownership:

- evaluation scripts
- test fixtures
- README setup instructions
- QA checklist
- CI workflow

Deliverables:

- RAG evaluation script.
- documented local setup.
- CI running lint, typecheck, and tests.
- manual acceptance checklist.

Boundaries:

- Do not rewrite implementation modules except to add test seams agreed with owning threads.

## 20. Acceptance Criteria For MVP

The MVP is acceptable when all required criteria are true. Stretch criteria are useful but must not block the first MVP.

Required:

- A new user can register, log in, and reach the library.
- A user can upload a born-digital CS paper PDF.
- The paper transitions from uploaded/parsing to ready without manual database edits.
- The paper detail page shows extracted title when available, abstract when available, page count, parsing diagnostics, and status.
- Page-level text is extracted and viewable in a developer-friendly detail area or preview.
- Chunks are created with page ranges, content hashes, and chunk version.
- Embeddings are stored for ready paper chunks.
- A user can ask a question about one ready paper.
- The assistant answer includes at least one validated citation for factual paper-content claims.
- Clicking a citation shows paper title, page range, quote, and chunk evidence.
- Assistant cited claims are stored and linked to citations.
- Failed parsing states are visible and retryable.
- Scanned or low-text PDFs are detected and handled with a clear unsupported or low-confidence message.
- API endpoints enforce user ownership.
- Uploaded files are not publicly accessible without authorization.
- Unit tests cover parsing helpers, chunking, citation validation, API validation, and ownership checks.
- At least one Playwright smoke test covers upload, ready status, single-paper chat, and citation drawer.
- The RAG evaluation script reports retrieval hit rate and citation validity on local fixtures.
- Local setup documentation is sufficient for a student developer to run the app and worker.
- Future Codex agents can work from this document without needing undocumented architectural assumptions.

Stretch after MVP:

- A user can ask a question across multiple selected ready papers.
- A user can compare 2-5 papers with cited evidence.
- A user can generate and edit a research note with citations.
- Playwright coverage includes compare and note workflows.
