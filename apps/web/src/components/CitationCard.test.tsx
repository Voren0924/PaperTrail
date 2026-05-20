import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ChatCitation } from "@/lib/types";

import { CitationCard } from "./CitationCard";

const citation: ChatCitation = {
  paperId: "paper-1",
  chunkId: "chunk-7",
  pageStart: 2,
  pageEnd: 3,
  sectionTitle: "Method",
  text: "Full chunk evidence text.",
  similarityScore: 0.82,
  label: "[paper-1, pp. 2-3]",
  quote: "Evidence snippet"
};

describe("CitationCard", () => {
  it("renders citation metadata without inventing fields", () => {
    const html = renderToStaticMarkup(
      <CitationCard citation={citation} paper={{ title: "Attention Paper", originalFileName: "attention.pdf" }} />
    );

    expect(html).toContain("Attention Paper");
    expect(html).toContain("Pages 2-3");
    expect(html).toContain("Method");
    expect(html).toContain("Evidence snippet");
    expect(html).toContain("chunk-7");
  });
});
