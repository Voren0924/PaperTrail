# @papertrail/db

Prisma database package for the local-first PaperTrail MVP.

## Local Setup

The MVP uses SQLite. The runtime sets a default local database URL when `DATABASE_URL` is not present:

```text
.data/PaperTrail/papertrail.db
```

For Prisma CLI commands, set:

```sh
DATABASE_URL=file:../../../.data/PaperTrail/papertrail.db
```

Then run:

```sh
corepack pnpm db:generate
corepack pnpm db:migrate
```

## Embeddings

SQLite does not provide pgvector. The local MVP stores embedding vectors in the `Embedding.vectorJson` column with provider, model, and dimension metadata. Retrieval loads candidate vectors and ranks them with TypeScript cosine similarity.

This keeps the desktop MVP self-contained and avoids a PostgreSQL service dependency. It is intended for MVP-scale local libraries; a future high-scale mode can introduce a native local vector index.

## Settings

Provider settings are stored in the `Setting` table. The API key is stored locally in SQLite for this migration pass and must not be logged or committed. OS keychain integration is a Tauri packaging follow-up.

## Tests

The database tests validate the Prisma schema and migration text without connecting to a live database.
