const assert = require("node:assert/strict");
const test = require("node:test");
const zlib = require("node:zlib");

const { parsePdf } = require("./parser");
const { chunkParsedPdf } = require("./chunker");
const { parseAndChunkPdf } = require("./pipeline");

test("parsePdf extracts page text, metadata, sections, and references", () => {
  const pdf = createFixturePdf([
    [
      "PaperTrail: Reliable PDF Parsing for CS Papers",
      "Abstract",
      "This paper presents a deterministic parsing pipeline for born digital research papers.",
      "1 Introduction",
      "Research assistants need page aware evidence when reading papers.",
    ],
    [
      "2 Method",
      "The method extracts page text, detects headings, and records diagnostics for low density pages.",
      "References",
      "[1] A. Author. Prior parsing systems. 2024.",
    ],
  ]);

  const parsed = parsePdf(pdf, { minPageChars: 20 });

  assert.equal(parsed.pageCount, 2);
  assert.match(parsed.pages[0].text, /PaperTrail: Reliable PDF Parsing/);
  assert.equal(parsed.metadata.title, "PaperTrail: Reliable PDF Parsing for CS Papers");
  assert.match(parsed.metadata.abstract, /deterministic parsing pipeline/);
  assert.deepEqual(parsed.sections.map((section) => section.title), ["Abstract", "Introduction", "Method", "References"]);
  assert.equal(parsed.references.length, 1);
  assert.equal(parsed.diagnostics.likelyScanned, false);
});

test("chunkParsedPdf creates page-aware chunks and excludes references by default", () => {
  const parsed = {
    pages: [
      {
        pageNumber: 1,
        text: "1 Introduction\n" + repeatWords("intro evidence", 45),
        charCount: 100,
      },
      {
        pageNumber: 2,
        text: "2 Method\n" + repeatWords("method details", 45),
        charCount: 100,
      },
      {
        pageNumber: 3,
        text: "References\n[1] Reference material should not be chunked by default.",
        charCount: 80,
      },
    ],
    sections: [
      { title: "Introduction", startPage: 1, endPage: 2, position: 0 },
      { title: "Method", startPage: 2, endPage: 3, position: 1 },
      { title: "References", startPage: 3, endPage: 3, position: 2 },
    ],
  };

  const chunks = chunkParsedPdf(parsed, { targetTokens: 40, overlapTokens: 8, minTokens: 10 });

  assert.ok(chunks.length > 1);
  assert.equal(chunks.some((chunk) => chunk.text.includes("Reference material")), false);
  assert.equal(chunks[0].startPage, 1);
  assert.ok(chunks.some((chunk) => chunk.endPage === 2));
  assert.equal(typeof chunks[0].contentHash, "string");
  assert.equal(chunks[0].contentHash.length, 64);
  assert.ok(chunks[0].pageTextOffsets["1"]);
});

test("parseAndChunkPdf marks low-text PDFs as not ready", () => {
  const pdf = createFixturePdf(["tiny", ""]);
  const result = parseAndChunkPdf(pdf, {
    parser: { minPageChars: 20 },
    chunker: { targetTokens: 50, overlapTokens: 5, minTokens: 1 },
  });

  assert.equal(result.ready, false);
  assert.match(result.failureReason, /scanned|too little extractable text/);
});

function repeatWords(words, count) {
  return Array.from({ length: count }, () => words).join(" ");
}

function createFixturePdf(pageLines) {
  const pages = pageLines.map((lines) => Array.isArray(lines) ? lines : [lines]);
  const objects = [];
  const pageObjectNumbers = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\nPAGES_PLACEHOLDER\nendobj\n");

  pages.forEach((lines, index) => {
    const pageObjectNumber = 3 + index * 2;
    const streamObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);

    const content = [
      "BT",
      "/F1 12 Tf",
      "72 720 Td",
      ...lines.flatMap((line, lineIndex) => [
        lineIndex === 0 ? "" : "T*",
        `(${escapePdfString(line)}) Tj`,
      ]).filter(Boolean),
      "ET",
    ].join("\n");
    const compressed = zlib.deflateSync(Buffer.from(content, "latin1"));

    objects.push(`${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /Contents ${streamObjectNumber} 0 R >>\nendobj\n`);
    objects.push(`${streamObjectNumber} 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n${compressed.toString("latin1")}\nendstream\nendobj\n`);
  });

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`;

  return Buffer.from(`%PDF-1.4\n${objects.join("")}%%EOF`, "latin1");
}

function escapePdfString(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
