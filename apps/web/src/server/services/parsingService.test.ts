import { describe, expect, it } from "vitest";

import {
  analyzeParsedPages,
  extractMetadataCandidates,
  extractReferenceCandidates,
  extractSectionCandidates,
  parsePdfBytes
} from "./parsingService";

describe("parsing service", () => {
  it("extracts page text through the pdf parser wrapper", async () => {
    const result = await parsePdfBytes(createMinimalPdf("Hello PaperTrail parser"));

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toMatchObject({
      pageNumber: 1,
      text: "Hello PaperTrail parser"
    });
  });

  it("detects low-text or scanned PDFs with deterministic text-density heuristics", () => {
    const result = analyzeParsedPages([
      { pageNumber: 1, text: "" },
      { pageNumber: 2, text: "x" }
    ]);

    expect(result.isLikelyScanned).toBe(true);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "LIKELY_SCANNED_OR_LOW_TEXT"
    );
  });

  it("extracts title, author, and abstract candidates", () => {
    const pages = analyzeParsedPages([
      {
        pageNumber: 1,
        text: [
          "Tracing Deterministic Paper Ingestion",
          "Alice Example, Bob Example",
          "Example University",
          "Abstract",
          "This paper presents a deterministic parser for research paper ingestion.",
          "1 Introduction",
          "Research assistants need inspectable parsing pipelines."
        ].join("\n")
      }
    ]).pages;

    expect(extractMetadataCandidates(pages)).toMatchObject({
      titleCandidate: "Tracing Deterministic Paper Ingestion",
      authorCandidates: ["Alice Example", "Bob Example"],
      abstractCandidate:
        "This paper presents a deterministic parser for research paper ingestion."
    });
  });

  it("detects numbered and common CS section headings", () => {
    const pages = analyzeParsedPages([
      {
        pageNumber: 1,
        text: ["Abstract", "summary", "1 Introduction", "intro text"].join("\n")
      },
      {
        pageNumber: 2,
        text: ["2 Related Work", "prior work", "Evaluation", "metrics"].join("\n")
      }
    ]).pages;

    expect(extractSectionCandidates(pages).map((section) => section.normalizedTitle)).toEqual([
      "abstract",
      "introduction",
      "related work",
      "evaluation"
    ]);
  });

  it("extracts reference candidates from a References section", () => {
    const pages = analyzeParsedPages([
      {
        pageNumber: 1,
        text: [
          "Conclusion",
          "The parser is deterministic.",
          "References",
          "[1] Alice Example and Bob Example. Deterministic Parsing for Papers. 2024.",
          "[2] Casey Researcher. Chunking Research Documents. 2023."
        ].join("\n")
      }
    ]).pages;

    const references = extractReferenceCandidates(pages);

    expect(references).toHaveLength(2);
    expect(references[0]).toMatchObject({
      authorsText: "Alice Example and Bob Example",
      year: 2024
    });
  });
});

function createMinimalPdf(text: string): Buffer {
  const safeText = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT /F1 24 Tf 72 720 Td (${safeText}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length ${stream.length}>>stream
${stream}
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000230 00000 n 
0000000299 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
${stream.length + 349}
%%EOF`;

  return Buffer.from(pdf);
}
