import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BadRequestError } from "@/server/errors/application-error";

import { LocalStorageAdapter } from "./local-storage";

describe("LocalStorageAdapter", () => {
  it("writes, reads, and deletes objects under the configured root", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "papertrail-storage-"));
    const adapter = new LocalStorageAdapter(rootDir);
    const bytes = new TextEncoder().encode("pdf bytes");

    await adapter.putObject({
      storageKey: "papers/user-1/paper.pdf",
      bytes,
      contentType: "application/pdf"
    });

    await expect(adapter.getObject({ storageKey: "papers/user-1/paper.pdf" })).resolves.toEqual(Buffer.from(bytes));

    await adapter.deleteObject({ storageKey: "papers/user-1/paper.pdf" });
    await expect(fs.access(path.join(rootDir, "papers/user-1/paper.pdf"))).rejects.toThrow();
  });

  it("rejects traversal outside the storage root", () => {
    const adapter = new LocalStorageAdapter(os.tmpdir());

    expect(() => adapter.resolveStoragePath("../paper.pdf")).toThrow(BadRequestError);
  });

  it("treats missing objects as already deleted", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "papertrail-storage-"));
    const adapter = new LocalStorageAdapter(rootDir);

    await expect(adapter.deleteObject({ storageKey: "missing.pdf" })).resolves.toBeUndefined();
  });
});
