import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(packageRoot, "prisma/schema.prisma");
const migrationPath = resolve(
  packageRoot,
  "prisma/migrations/000001_init/migration.sql"
);

describe("Prisma schema", () => {
  it("contains the required Thread B models", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const models = [
      "User",
      "Session",
      "Paper",
      "PaperAuthor",
      "PaperPage",
      "PaperSection",
      "PaperChunk",
      "PaperReference",
      "ChatSession",
      "ChatSessionPaper",
      "ChatMessage",
      "ChatCitation",
      "ChatCitedClaim",
      "ResearchNote",
      "ResearchNoteCitation",
      "Job"
    ];

    for (const model of models) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("contains the required enums", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const enums = [
      "PaperStatus",
      "JobStatus",
      "JobType",
      "ChatRole",
      "MessageStatus",
      "ChatScopeType"
    ];

    for (const enumName of enums) {
      expect(schema).toContain(`enum ${enumName} {`);
    }
  });

  it("documents the pgvector-compatible embedding strategy", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const migration = await readFile(migrationPath, "utf8");

    expect(schema).toContain('embedding       Unsupported("vector(1536)")?');
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(migration).toContain("USING ivfflat (embedding vector_cosine_ops)");
  });
});
