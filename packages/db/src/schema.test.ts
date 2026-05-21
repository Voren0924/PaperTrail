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
  it("contains the required local desktop models", async () => {
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
      "Job",
      "Embedding",
      "Setting"
    ];

    for (const model of models) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("uses SQLite for local-first desktop persistence", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const migration = await readFile(migrationPath, "utf8");

    expect(schema).toContain('provider = "sqlite"');
    expect(migration).toContain('CREATE TABLE "Setting"');
    expect(migration).toContain('CREATE TABLE "Embedding"');
  });

  it("documents the SQLite-friendly embedding strategy", async () => {
    const schema = await readFile(schemaPath, "utf8");
    const migration = await readFile(migrationPath, "utf8");

    expect(schema).toContain("vectorJson String");
    expect(schema).toContain("@@unique([chunkId, provider, model])");
    expect(migration).not.toContain("CREATE EXTENSION");
    expect(migration).not.toContain("ivfflat");
  });
});
