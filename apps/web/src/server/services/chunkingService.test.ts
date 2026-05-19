import { describe, expect, it } from "vitest";

import { CHUNK_VERSION, createPaperChunks, hashChunkText } from "./chunkingService";
import type { ParsedPdfPage, SectionCandidate } from "./parsingService";

describe("chunking service", () => {
  it("creates chunks with page ranges, section labels, offsets, hashes, and versioning", () => {
    const pages = [
      createPage(1, "Introduction\n" + repeatSentence("Page one method context.", 50)),
      createPage(2, repeatSentence("Page two evaluation context.", 50))
    ];
    const sections: SectionCandidate[] = [
      {
        title: "Introduction",
        normalizedTitle: "introduction",
        pageNumber: 1,
        lineIndex: 0,
        position: 0
      }
    ];

    const chunks = createPaperChunks({ pages, sections });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toMatchObject({
      pageStart: 1,
      pageEnd: 2,
      sectionLabel: "Introduction",
      sectionNormalizedTitle: "introduction",
      chunkVersion: CHUNK_VERSION
    });
    expect(chunks[0]?.charStart).toEqual(expect.any(Number));
    expect(chunks[0]?.charEnd).toEqual(expect.any(Number));
    expect(chunks[0]?.pageTextOffsets["1"]).toBeDefined();
    expect(chunks[0]?.contentHash).toBe(hashChunkText(chunks[0]?.text ?? ""));
  });

  it("falls back to page-aware chunks and filters tiny low-information pages", () => {
    const pages = [
      createPage(1, "header"),
      createPage(2, repeatSentence("A useful page-aware chunk contains enough research context.", 12))
    ];

    const chunks = createPaperChunks({ pages, sections: [] });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      pageStart: 2,
      pageEnd: 2,
      sectionLabel: null
    });
  });

  it("produces deterministic content hashes", () => {
    const text = "Deterministic   Chunk Text";

    expect(hashChunkText(text)).toBe(hashChunkText("deterministic chunk text"));
  });
});

function createPage(pageNumber: number, text: string): ParsedPdfPage {
  return {
    pageNumber,
    text,
    charCount: text.length,
    textDensity: text.length
  };
}

function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(" ");
}
