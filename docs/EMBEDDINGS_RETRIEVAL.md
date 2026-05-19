# Embeddings And Retrieval

Thread F adds the server-side foundation for embedding paper chunks and retrieving relevant evidence chunks. It does not generate natural-language answers or implement chat response synthesis.

## Configuration

Embeddings are configured separately from chat model settings:

```text
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

`EMBEDDING_API_KEY` must only be set in local or deployment environment files that are not committed. The key is used only by server-side services and workers.

`EMBEDDING_DIMENSIONS` must match the existing Prisma/pgvector schema:

```prisma
embedding Unsupported("vector(1536)")?
```

The default concrete provider is OpenAI-compatible and calls `POST /embeddings` on `EMBEDDING_BASE_URL`. This supports OpenAI and providers that implement the same embeddings API shape. Chat provider settings remain separate and are not used by retrieval.

## Embedding Jobs

The ingestion pipeline persists pages, sections, references, and chunks, then enqueues an `EMBED_PAPER` job. The worker handles both `PARSE_PAPER` and `EMBED_PAPER` jobs through the existing database-backed `Job` table.

For each embedding job:

1. The paper status is set to `EMBEDDING`.
2. Chunks are selected when `embedding IS NULL` or `embeddingModel` differs from the configured embedding model.
3. The provider embeds chunk text in batches.
4. Vectors are validated against 1536 dimensions.
5. `PaperChunk.embedding` is updated with pgvector raw SQL and `embeddingModel` is set to the provider model.
6. The paper is marked `READY` after all current chunks are embedded.
7. Provider or validation failures mark the paper `FAILED` with a safe diagnostic message.

Existing current embeddings are skipped by the SQL selection criteria. Chunk freshness is based on the existing `contentHash`, `chunkVersion`, and current chunk rows created by Thread E.

## Retrieval

`retrievalService` exposes an internal service for Thread G:

```ts
retrieve({
  userId,
  query,
  paperIds,
  topK
})
```

The service:

- trims and validates the query;
- verifies every requested paper belongs to the current user;
- embeds the query through the embedding provider;
- runs pgvector cosine similarity search over `PaperChunk.embedding`;
- returns citation-ready metadata:
  - `paperId`
  - `chunkId`
  - `pageStart`
  - `pageEnd`
  - `sectionTitle`
  - `text`
  - `similarityScore`

The default `topK` is 8 and the maximum is 20. A `minSimilarity` threshold can be supplied by future callers, but no default threshold is enforced.

## pgvector Notes

Prisma cannot express pgvector similarity operators for unsupported vector columns, so vector update and search use parameterized raw SQL with pgvector casts:

```sql
"embedding" = $1::vector
"embedding" <=> $1::vector
```

Local integration testing requires PostgreSQL with the `vector` extension and the existing migrations applied. The current unit tests validate SQL construction and repository behavior without requiring a live pgvector database.

## Boundaries

This thread intentionally does not implement:

- final answer generation;
- grounded answer prompts;
- chat API response logic;
- frontend retrieval UI;
- external queues or Redis;
- alternate ORMs.
