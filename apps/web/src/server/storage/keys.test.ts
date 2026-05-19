import { describe, expect, it } from "vitest";

import { createPdfStorageKey, sanitizeBaseName } from "./keys";

describe("storage keys", () => {
  it("sanitizes unsafe file names", () => {
    expect(sanitizeBaseName("../My Paper (Final)!")).toBe("..-My-Paper-Final");
  });

  it("generates scoped PDF storage keys", () => {
    const key = createPdfStorageKey({
      userId: "user-1",
      originalFileName: "My Paper.pdf",
      fileSha256: "abcdef0123456789abcdef0123456789"
    });

    expect(key).toMatch(
      /^papers\/user-1\/\d{4}-\d{2}-\d{2}\/My-Paper-abcdef0123456789-[0-9a-f-]{36}\.pdf$/
    );
  });
});
