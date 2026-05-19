import { createHash } from "node:crypto";

import type { ParsedPdfPage, SectionCandidate } from "./parsingService";

export const CHUNK_VERSION = 1;
export const PENDING_EMBEDDING_MODEL = "pending";

export type PaperChunkInput = {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  pageStart: number;
  pageEnd: number;
  charStart: number | null;
  charEnd: number | null;
  pageTextOffsets: Record<string, { start: number; end: number }>;
  contentHash: string;
  chunkVersion: number;
  sectionLabel: string | null;
  sectionNormalizedTitle: string | null;
  embeddingModel: string;
};

export type ChunkingInput = {
  pages: ParsedPdfPage[];
  sections: SectionCandidate[];
};

type PageSpan = {
  pageNumber: number;
  charStart: number;
  charEnd: number;
};

type SectionSpan = {
  title: string | null;
  normalizedTitle: string | null;
  charStart: number;
  charEnd: number;
};

const TARGET_TOKENS = 750;
const OVERLAP_TOKENS = 100;
const MIN_USEFUL_TOKENS = 35;
const MAX_TOKENS = 900;

export function createPaperChunks(input: ChunkingInput): PaperChunkInput[] {
  const document = buildDocument(input.pages);
  const referenceStart = findReferenceStart(input.sections, document.pageSpans);
  const contentEnd = referenceStart ?? document.text.length;
  const sections = buildSectionSpans(input.sections, document, contentEnd);
  const segments = sections.length > 0 ? sections : buildPageSegments(document.pageSpans, contentEnd);
  const chunks: PaperChunkInput[] = [];

  for (const segment of segments) {
    const segmentText = document.text.slice(segment.charStart, segment.charEnd).trim();

    if (!hasUsefulInformation(segmentText)) {
      continue;
    }

    for (const chunk of chunkSegment(document, segment, chunks.length)) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

export function hashChunkText(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

export function estimateTokenCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildDocument(pages: ParsedPdfPage[]): { text: string; pageSpans: PageSpan[] } {
  let text = "";
  const pageSpans: PageSpan[] = [];

  for (const page of pages) {
    if (text.length > 0) {
      text += "\n\n";
    }

    const charStart = text.length;
    text += page.text;
    const charEnd = text.length;

    pageSpans.push({
      pageNumber: page.pageNumber,
      charStart,
      charEnd
    });
  }

  return { text, pageSpans };
}

function buildSectionSpans(
  sections: SectionCandidate[],
  document: { text: string; pageSpans: PageSpan[] },
  contentEnd: number
): SectionSpan[] {
  const sectionStarts = sections
    .filter((section) => section.normalizedTitle !== "references" && section.normalizedTitle !== "bibliography")
    .map((section) => {
      const pageSpan = document.pageSpans.find((span) => span.pageNumber === section.pageNumber);
      const searchStart = pageSpan?.charStart ?? 0;
      const searchEnd = pageSpan?.charEnd ?? document.text.length;
      const titleOffset = document.text
        .slice(searchStart, searchEnd)
        .toLowerCase()
        .indexOf(section.title.toLowerCase());

      return {
        title: section.title,
        normalizedTitle: section.normalizedTitle,
        charStart: titleOffset >= 0 ? searchStart + titleOffset : searchStart
      };
    })
    .filter((section) => section.charStart < contentEnd)
    .sort((a, b) => a.charStart - b.charStart);

  return sectionStarts.map((section, index) => ({
    title: section.title,
    normalizedTitle: section.normalizedTitle,
    charStart: section.charStart,
    charEnd: sectionStarts[index + 1]?.charStart ?? contentEnd
  }));
}

function buildPageSegments(pageSpans: PageSpan[], contentEnd: number): SectionSpan[] {
  return pageSpans
    .filter((span) => span.charStart < contentEnd)
    .map((span) => ({
      title: null,
      normalizedTitle: null,
      charStart: span.charStart,
      charEnd: Math.min(span.charEnd, contentEnd)
    }));
}

function findReferenceStart(sections: SectionCandidate[], pageSpans: PageSpan[]): number | null {
  const reference = sections.find(
    (section) => section.normalizedTitle === "references" || section.normalizedTitle === "bibliography"
  );

  if (!reference) {
    return null;
  }

  return pageSpans.find((span) => span.pageNumber === reference.pageNumber)?.charStart ?? null;
}

function chunkSegment(
  document: { text: string; pageSpans: PageSpan[] },
  segment: SectionSpan,
  startingIndex: number
): PaperChunkInput[] {
  const segmentText = document.text.slice(segment.charStart, segment.charEnd);
  const words = collectWords(segmentText);

  if (words.length < MIN_USEFUL_TOKENS && !isUsefulSectionHeader(segment.title, words.length)) {
    return [];
  }

  const chunks: PaperChunkInput[] = [];
  let cursor = 0;

  while (cursor < words.length) {
    const end = Math.min(cursor + TARGET_TOKENS, words.length);
    const chunkWords = words.slice(cursor, end);
    const tokenCount = chunkWords.length;

    if (tokenCount < MIN_USEFUL_TOKENS && !isUsefulSectionHeader(segment.title, tokenCount)) {
      break;
    }

    const firstWord = chunkWords[0];
    const lastWord = chunkWords[chunkWords.length - 1];

    if (!firstWord || !lastWord) {
      break;
    }

    const charStart = segment.charStart + firstWord.start;
    const charEnd = segment.charStart + lastWord.end;
    const text = segmentText.slice(firstWord.start, lastWord.end).trim();
    const pageRange = getPageRange(document.pageSpans, charStart, charEnd);

    chunks.push({
      chunkIndex: startingIndex + chunks.length,
      text,
      tokenCount: Math.min(tokenCount, MAX_TOKENS),
      pageStart: pageRange.pageStart,
      pageEnd: pageRange.pageEnd,
      charStart,
      charEnd,
      pageTextOffsets: getPageTextOffsets(document.pageSpans, charStart, charEnd),
      contentHash: hashChunkText(text),
      chunkVersion: CHUNK_VERSION,
      sectionLabel: segment.title,
      sectionNormalizedTitle: segment.normalizedTitle,
      embeddingModel: PENDING_EMBEDDING_MODEL
    });

    if (end >= words.length) {
      break;
    }

    cursor = Math.max(end - OVERLAP_TOKENS, cursor + 1);
  }

  return chunks;
}

function collectWords(text: string): Array<{ value: string; start: number; end: number }> {
  const matches = text.matchAll(/\S+/g);

  return [...matches].map((match) => ({
    value: match[0],
    start: match.index,
    end: match.index + match[0].length
  }));
}

function getPageRange(
  pageSpans: PageSpan[],
  charStart: number,
  charEnd: number
): { pageStart: number; pageEnd: number } {
  const overlapping = pageSpans.filter((span) => span.charEnd >= charStart && span.charStart <= charEnd);

  return {
    pageStart: overlapping[0]?.pageNumber ?? pageSpans[0]?.pageNumber ?? 1,
    pageEnd: overlapping[overlapping.length - 1]?.pageNumber ?? pageSpans[0]?.pageNumber ?? 1
  };
}

function getPageTextOffsets(
  pageSpans: PageSpan[],
  charStart: number,
  charEnd: number
): Record<string, { start: number; end: number }> {
  const offsets: Record<string, { start: number; end: number }> = {};

  for (const span of pageSpans) {
    const overlapStart = Math.max(charStart, span.charStart);
    const overlapEnd = Math.min(charEnd, span.charEnd);

    if (overlapStart <= overlapEnd) {
      offsets[String(span.pageNumber)] = {
        start: Math.max(0, overlapStart - span.charStart),
        end: Math.max(0, overlapEnd - span.charStart)
      };
    }
  }

  return offsets;
}

function hasUsefulInformation(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  const alphaNumericChars = (text.match(/[A-Za-z0-9]/g) ?? []).length;

  return words.length >= MIN_USEFUL_TOKENS && alphaNumericChars >= 120;
}

function isUsefulSectionHeader(title: string | null, tokenCount: number): boolean {
  return Boolean(title && tokenCount >= 8);
}

function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
