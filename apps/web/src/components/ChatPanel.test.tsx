import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ChatCitation } from "@/lib/types";

import { ChatTranscript } from "./ChatPanel";

const citation: ChatCitation = {
  paperId: "paper-1",
  chunkId: "chunk-1",
  pageStart: 4,
  pageEnd: 4,
  sectionTitle: "Evaluation",
  text: "The model improves retrieval hit rate in the reported benchmark.",
  similarityScore: 0.91,
  label: "[paper-1, p. 4]",
  quote: "The model improves retrieval hit rate"
};

describe("ChatTranscript", () => {
  it("renders insufficient-evidence state", () => {
    const html = renderToStaticMarkup(
      <ChatTranscript
        paper={{ title: "RAG Paper", originalFileName: "rag.pdf" }}
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "I do not have enough retrieved evidence to answer this question.",
            insufficientEvidence: true,
            citations: []
          }
        ]}
      />
    );

    expect(html).toContain("insufficient retrieved evidence");
  });

  it("renders mocked citation responses from the chat API shape", () => {
    const html = renderToStaticMarkup(
      <ChatTranscript
        paper={{ title: "RAG Paper", originalFileName: "rag.pdf" }}
        messages={[
          {
            id: "assistant-2",
            role: "assistant",
            content: "The method improves retrieval.",
            citations: [citation]
          }
        ]}
      />
    );

    expect(html).toContain("The method improves retrieval.");
    expect(html).toContain("[paper-1, p. 4]");
    expect(html).toContain("chunk-1");
  });
});
