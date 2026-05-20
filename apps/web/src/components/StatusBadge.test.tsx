import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { canRetryPaper, isPaperReady, StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders known processing status labels", () => {
    const html = renderToStaticMarkup(<StatusBadge status="EMBEDDING" />);

    expect(html).toContain("Embedding");
    expect(html).toContain("status-badge--progress");
  });

  it("reports ready and retryable statuses", () => {
    expect(isPaperReady("READY")).toBe(true);
    expect(isPaperReady("PARSING")).toBe(false);
    expect(canRetryPaper("FAILED")).toBe(true);
    expect(canRetryPaper("READY")).toBe(false);
  });
});
