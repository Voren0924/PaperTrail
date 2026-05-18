const crypto = require("node:crypto");

const CHUNK_VERSION = 1;
const DEFAULT_TARGET_TOKENS = 700;
const DEFAULT_OVERLAP_TOKENS = 100;
const DEFAULT_MIN_TOKENS = 30;

function chunkParsedPdf(parsedPdf, options = {}) {
  const targetTokens = options.targetTokens || DEFAULT_TARGET_TOKENS;
  const overlapTokens = options.overlapTokens || DEFAULT_OVERLAP_TOKENS;
  const minTokens = options.minTokens || DEFAULT_MIN_TOKENS;
  const includeReferences = options.includeReferences === true;

  const tokenRows = buildTokenRows(parsedPdf, includeReferences);
  const chunks = [];
  let start = 0;

  while (start < tokenRows.length) {
    const end = Math.min(start + targetTokens, tokenRows.length);
    const rows = tokenRows.slice(start, end);
    const text = rows.map((row) => row.token).join(" ").trim();
    const tokenCount = estimateTokenCount(text);

    if (tokenCount >= minTokens && hasInformationContent(text)) {
      chunks.push(buildChunk(parsedPdf, rows, text, chunks.length));
    }

    if (end === tokenRows.length) {
      break;
    }

    start = Math.max(end - overlapTokens, start + 1);
  }

  return chunks;
}

function buildTokenRows(parsedPdf, includeReferences) {
  const referenceStartPage = includeReferences ? Number.POSITIVE_INFINITY : findReferenceStartPage(parsedPdf.sections || []);
  const rows = [];
  let globalOffset = 0;

  for (const page of parsedPdf.pages || []) {
    if (page.pageNumber >= referenceStartPage) {
      continue;
    }

    const tokens = tokenizeWithOffsets(page.text);
    for (const token of tokens) {
      rows.push({
        token: token.value,
        pageNumber: page.pageNumber,
        pageStart: token.start,
        pageEnd: token.end,
        globalStart: globalOffset + token.start,
        globalEnd: globalOffset + token.end,
      });
    }

    globalOffset += page.text.length + 2;
  }

  return rows;
}

function tokenizeWithOffsets(text) {
  const tokens = [];
  const pattern = /\S+/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    tokens.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

function buildChunk(parsedPdf, rows, text, chunkIndex) {
  const startPage = rows[0].pageNumber;
  const endPage = rows[rows.length - 1].pageNumber;
  const section = findSectionForRange(parsedPdf.sections || [], startPage, endPage);

  return {
    chunkIndex,
    text,
    tokenCount: estimateTokenCount(text),
    startPage,
    endPage,
    sectionTitle: section?.title || null,
    charStart: rows[0].globalStart,
    charEnd: rows[rows.length - 1].globalEnd,
    pageTextOffsets: buildPageTextOffsets(rows),
    contentHash: hashContent(text),
    chunkVersion: CHUNK_VERSION,
  };
}

function buildPageTextOffsets(rows) {
  const offsets = {};

  for (const row of rows) {
    const existing = offsets[row.pageNumber];
    if (!existing) {
      offsets[row.pageNumber] = { start: row.pageStart, end: row.pageEnd };
      continue;
    }

    existing.start = Math.min(existing.start, row.pageStart);
    existing.end = Math.max(existing.end, row.pageEnd);
  }

  return offsets;
}

function findSectionForRange(sections, startPage, endPage) {
  return sections.find((section) => {
    const sectionEndPage = section.endPage || section.startPage;
    return section.startPage <= endPage && sectionEndPage >= startPage && !/^(references|bibliography)$/i.test(section.title);
  }) || null;
}

function findReferenceStartPage(sections) {
  const referenceSection = sections.find((section) => /^(references|bibliography)$/i.test(section.title));
  return referenceSection?.startPage || Number.POSITIVE_INFINITY;
}

function estimateTokenCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function hasInformationContent(text) {
  const alphaNumericCount = (text.match(/[A-Za-z0-9]/g) || []).length;
  return alphaNumericCount >= Math.max(20, text.length * 0.35);
}

function hashContent(text) {
  return crypto.createHash("sha256").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
}

module.exports = {
  CHUNK_VERSION,
  chunkParsedPdf,
  estimateTokenCount,
};
