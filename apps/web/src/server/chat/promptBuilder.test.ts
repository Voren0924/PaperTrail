import { describe, expect, it } from "vitest";

import { buildGroundedAnswerMessages, formatEvidenceChunks } from "./promptBuilder";
import { createRetrievedChunk } from "./test-helpers";

describe("grounded answer prompt builder", () => {
  it("includes retrieved chunk IDs and evidence metadata", () => {
    const messages = buildGroundedAnswerMessages({
      question: "What is the method?",
      chunks: [createRetrievedChunk({ chunkId: "chunk-1", sectionTitle: "Method" })]
    });

    expect(messages[0]?.content).toContain("using only the supplied evidence chunks");
    expect(messages[1]?.content).toContain("Question: What is the method?");
    expect(messages[1]?.content).toContain("Chunk ID: chunk-1");
    expect(messages[1]?.content).toContain("Section: Method");
  });

  it("formats chunk evidence deterministically", () => {
    expect(formatEvidenceChunks([createRetrievedChunk({ chunkId: "chunk-1" })])).toContain(
      "Evidence 1\nChunk ID: chunk-1"
    );
  });
});
