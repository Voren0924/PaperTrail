import { describe, expect, it } from "vitest";

import { createPdfStorageKey, sanitizeBaseName } from "./keys";

describe("storage keys", () => {
  it("sanitizes unsafe file names", () => {
    expect(sanitizeBaseName("../My Paper (Final)!")).toBe("..-My-Paper-Final");
  });

  it("generates scoped PDF storage keys", () => {
    const key = createPdfStorageKey({
      paperId: "paper-1",
      originalFileName: "My Paper.pdf"
    });

    expect(key).toBe("files/paper-1.pdf");
  });
});
