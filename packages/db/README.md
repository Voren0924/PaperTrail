# @papertrail/db

Prisma database package for PaperTrail.

## Local setup

1. Start PostgreSQL with the `pgvector` extension available.
2. Set `DATABASE_URL` in your local environment.
3. Run migrations:

```sh
corepack pnpm db:migrate
```

The initial migration runs `CREATE EXTENSION IF NOT EXISTS vector;`. On managed PostgreSQL, the database role may need permission to install extensions. If extension creation is restricted, ask an administrator to run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## pgvector and Prisma

Prisma does not expose first-class vector operators or indexes. The `PaperChunk.embedding` field is modeled as `Unsupported("vector(1536)")`, and the initial migration creates the vector column plus an `ivfflat` index with raw SQL.

Application retrieval code should use raw SQL for vector similarity queries until Prisma adds complete pgvector support.

## Tests

The current database tests validate the Prisma schema and migration text without connecting to PostgreSQL. Future integration tests should run against a local PostgreSQL instance with pgvector enabled.
