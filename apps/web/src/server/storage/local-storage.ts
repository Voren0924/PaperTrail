import fs from "node:fs/promises";
import path from "node:path";

import { BadRequestError } from "@/server/errors/application-error";

export type StoredObject = {
  storageKey: string;
};

export type StorageAdapter = {
  putObject(input: { storageKey: string; bytes: Uint8Array; contentType: string }): Promise<StoredObject>;
  getObject(input: { storageKey: string }): Promise<Uint8Array>;
  deleteObject(input: { storageKey: string }): Promise<void>;
};

export class LocalStorageAdapter implements StorageAdapter {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async putObject(input: { storageKey: string; bytes: Uint8Array; contentType: string }): Promise<StoredObject> {
    const destinationPath = this.resolveStoragePath(input.storageKey);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, input.bytes);

    return { storageKey: input.storageKey };
  }

  async getObject(input: { storageKey: string }): Promise<Uint8Array> {
    const objectPath = this.resolveStoragePath(input.storageKey);
    return fs.readFile(objectPath);
  }

  async deleteObject(input: { storageKey: string }): Promise<void> {
    const objectPath = this.resolveStoragePath(input.storageKey);

    try {
      await fs.unlink(objectPath);
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }

      throw error;
    }
  }

  resolveStoragePath(storageKey: string): string {
    const normalizedKey = storageKey.replace(/\\/g, "/");

    if (!normalizedKey || path.isAbsolute(normalizedKey) || normalizedKey.includes("../")) {
      throw new BadRequestError("Storage key is invalid.");
    }

    const resolvedPath = path.resolve(this.rootDir, normalizedKey);
    const relativePath = path.relative(this.rootDir, resolvedPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new BadRequestError("Storage key is outside the configured storage directory.");
    }

    return resolvedPath;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
