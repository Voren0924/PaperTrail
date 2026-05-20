import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Paper } from "@/lib/types";

import { PaperListContent } from "./PaperListPage";

const paper: Paper = {
  id: "paper-1",
  title: "A Grounded QA System",
  abstract: null,
  originalFileName: "grounded-qa.pdf",
  fileSha256: "abc123",
  pageCount: 12,
  status: "READY",
  statusMessage: null,
  createdAt: "2026-05-19T08:00:00.000Z",
  updatedAt: "2026-05-19T08:10:00.000Z"
};

describe("PaperListContent", () => {
  it("renders the empty state", () => {
    const html = renderToStaticMarkup(<PaperListContent papers={[]} />);

    expect(html).toContain("No papers yet");
    expect(html).toContain("Upload PDF");
  });

  it("renders paper list rows with status and page count", () => {
    const html = renderToStaticMarkup(<PaperListContent papers={[paper]} />);

    expect(html).toContain("A Grounded QA System");
    expect(html).toContain("grounded-qa.pdf");
    expect(html).toContain("Ready");
    expect(html).toContain("12");
  });
});
