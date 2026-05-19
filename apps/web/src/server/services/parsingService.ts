import { PDFParse } from "pdf-parse";

export type ParsedPdfPage = {
  pageNumber: number;
  text: string;
  charCount: number;
  textDensity: number;
};

export type ParserDiagnostic = {
  code: string;
  message: string;
  pageNumber?: number;
};

export type MetadataCandidates = {
  titleCandidate: string | null;
  authorCandidates: string[];
  abstractCandidate: string | null;
};

export type SectionCandidate = {
  title: string;
  normalizedTitle: string;
  pageNumber: number;
  lineIndex: number;
  position: number;
};

export type ReferenceCandidate = {
  rawText: string;
  title: string | null;
  authorsText: string | null;
  year: number | null;
  position: number;
};

export type ParsePdfResult = {
  pages: ParsedPdfPage[];
  pageCount: number;
  metadata: MetadataCandidates;
  sections: SectionCandidate[];
  references: ReferenceCandidate[];
  diagnostics: ParserDiagnostic[];
  isLikelyScanned: boolean;
};

const LOW_TEXT_PAGE_CHAR_THRESHOLD = 80;
const LOW_TEXT_DOCUMENT_AVERAGE_THRESHOLD = 120;
const LOW_TEXT_PAGE_RATIO_THRESHOLD = 0.6;

const COMMON_SECTION_TITLES = [
  "abstract",
  "introduction",
  "background",
  "related work",
  "method",
  "methods",
  "methodology",
  "approach",
  "model",
  "experiments",
  "experimental setup",
  "evaluation",
  "results",
  "discussion",
  "limitations",
  "conclusion",
  "conclusions",
  "future work",
  "references",
  "bibliography"
];

export async function parsePdfBytes(pdfBytes: Buffer): Promise<ParsePdfResult> {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: pdfBytes });
    const textResult = await parser.getText();
    const pages = normalizeExtractedPages(textResult.pages);

    return analyzeParsedPages(pages);
  } catch (error) {
    throw new PdfParsingError("Unable to read PDF text.", error);
  } finally {
    await parser?.destroy();
  }
}

export class PdfParsingError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PdfParsingError";
    this.cause = cause;
  }
}

export function analyzeParsedPages(
  pages: Array<{ pageNumber: number; text: string }>
): ParsePdfResult {
  const normalizedPages = pages.map((page) => {
    const text = normalizePdfText(page.text);
    const charCount = countMeaningfulCharacters(text);

    return {
      pageNumber: page.pageNumber,
      text,
      charCount,
      textDensity: charCount
    };
  });
  const diagnostics = buildTextDensityDiagnostics(normalizedPages);
  const isLikelyScanned = detectLikelyScannedDocument(normalizedPages);

  return {
    pages: normalizedPages,
    pageCount: normalizedPages.length,
    metadata: extractMetadataCandidates(normalizedPages),
    sections: extractSectionCandidates(normalizedPages),
    references: extractReferenceCandidates(normalizedPages),
    diagnostics,
    isLikelyScanned
  };
}

export function extractMetadataCandidates(pages: ParsedPdfPage[]): MetadataCandidates {
  const firstPageLines = getMeaningfulLines(pages[0]?.text ?? "");
  const abstractCandidate = extractAbstractCandidate(pages);
  const abstractLineIndex = firstPageLines.findIndex((line) => isAbstractHeading(line));
  const titleCandidate =
    firstPageLines.find((line, index) => {
      if (abstractLineIndex >= 0 && index >= abstractLineIndex) {
        return false;
      }

      return isPossibleTitleLine(line);
    }) ?? null;
  const titleIndex = titleCandidate ? firstPageLines.indexOf(titleCandidate) : -1;
  const authorCandidates = extractAuthorCandidates(firstPageLines, titleIndex, abstractLineIndex);

  return {
    titleCandidate,
    authorCandidates,
    abstractCandidate
  };
}

export function extractSectionCandidates(pages: ParsedPdfPage[]): SectionCandidate[] {
  const sections: SectionCandidate[] = [];

  for (const page of pages) {
    const lines = getMeaningfulLines(page.text);

    for (const [lineIndex, line] of lines.entries()) {
      const title = getSectionTitle(line);

      if (!title) {
        continue;
      }

      const normalizedTitle = normalizeHeading(title);

      if (sections.some((section) => section.normalizedTitle === normalizedTitle)) {
        continue;
      }

      sections.push({
        title,
        normalizedTitle,
        pageNumber: page.pageNumber,
        lineIndex,
        position: sections.length
      });
    }
  }

  return sections;
}

export function extractReferenceCandidates(pages: ParsedPdfPage[]): ReferenceCandidate[] {
  const referenceStart = findReferenceStart(pages);

  if (!referenceStart) {
    return [];
  }

  const referenceText = pages
    .filter((page) => page.pageNumber >= referenceStart.pageNumber)
    .map((page) => {
      if (page.pageNumber !== referenceStart.pageNumber) {
        return page.text;
      }

      const lines = getMeaningfulLines(page.text);
      return lines.slice(referenceStart.lineIndex + 1).join("\n");
    })
    .join("\n");

  return splitReferenceEntries(referenceText).map((rawText, position) => {
    const yearMatch = rawText.match(/\b(19|20)\d{2}\b/);

    return {
      rawText,
      title: extractReferenceTitle(rawText),
      authorsText: extractReferenceAuthors(rawText),
      year: yearMatch ? Number(yearMatch[0]) : null,
      position
    };
  });
}

export function normalizeHeading(value: string): string {
  return value
    .replace(/^\d+(\.\d+)*\.?\s+/, "")
    .replace(/^\[[^\]]+\]\s+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeExtractedPages(pages: Array<{ num: number; text: string }>): ParsedPdfPage[] {
  return [...pages]
    .sort((a, b) => a.num - b.num)
    .map((page) => {
      const text = normalizePdfText(page.text);
      const charCount = countMeaningfulCharacters(text);

      return {
        pageNumber: page.num,
        text,
        charCount,
        textDensity: charCount
      };
    });
}

function normalizePdfText(text: string): string {
  return text
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/\r\n?/g, "\n")
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countMeaningfulCharacters(text: string): number {
  return (text.match(/[A-Za-z0-9]/g) ?? []).length;
}

function detectLikelyScannedDocument(pages: ParsedPdfPage[]): boolean {
  if (pages.length === 0) {
    return true;
  }

  const lowTextPages = pages.filter((page) => page.charCount < LOW_TEXT_PAGE_CHAR_THRESHOLD);
  const averageTextDensity =
    pages.reduce((total, page) => total + page.textDensity, 0) / Math.max(pages.length, 1);

  return (
    lowTextPages.length / pages.length >= LOW_TEXT_PAGE_RATIO_THRESHOLD ||
    averageTextDensity < LOW_TEXT_DOCUMENT_AVERAGE_THRESHOLD
  );
}

function buildTextDensityDiagnostics(pages: ParsedPdfPage[]): ParserDiagnostic[] {
  const diagnostics: ParserDiagnostic[] = [];

  for (const page of pages) {
    if (page.charCount < LOW_TEXT_PAGE_CHAR_THRESHOLD) {
      diagnostics.push({
        code: "LOW_TEXT_PAGE",
        message: "Page has very little extractable text.",
        pageNumber: page.pageNumber
      });
    }
  }

  if (detectLikelyScannedDocument(pages)) {
    diagnostics.push({
      code: "LIKELY_SCANNED_OR_LOW_TEXT",
      message: "Most pages have too little extractable text for reliable chunking."
    });
  }

  return diagnostics;
}

function getMeaningfulLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isPossibleTitleLine(line: string): boolean {
  const normalized = normalizeHeading(line);

  return (
    line.length >= 8 &&
    line.length <= 180 &&
    !COMMON_SECTION_TITLES.includes(normalized) &&
    !/^(arxiv|doi:|http|www\.|\d+)$/.test(normalized)
  );
}

function extractAuthorCandidates(
  lines: string[],
  titleIndex: number,
  abstractLineIndex: number
): string[] {
  if (titleIndex < 0) {
    return [];
  }

  const endIndex = abstractLineIndex >= 0 ? abstractLineIndex : Math.min(titleIndex + 4, lines.length);
  const candidateLines = lines.slice(titleIndex + 1, endIndex);
  const authorLine = candidateLines.find((line) => {
    const normalized = line.toLowerCase();

    return (
      /[,;]/.test(line) ||
      /\band\b/i.test(line) ||
      (!normalized.includes("@") && !normalized.includes("university") && line.split(/\s+/).length <= 12)
    );
  });

  if (!authorLine) {
    return [];
  }

  return authorLine
    .replace(/\d+/g, "")
    .split(/,|;|\band\b/i)
    .map((author) => author.trim())
    .filter((author) => author.length >= 2);
}

function extractAbstractCandidate(pages: ParsedPdfPage[]): string | null {
  const allLines = pages.flatMap((page) =>
    getMeaningfulLines(page.text).map((line) => ({ line, pageNumber: page.pageNumber }))
  );
  const abstractIndex = allLines.findIndex(({ line }) => isAbstractHeading(line));

  if (abstractIndex < 0) {
    return null;
  }

  const abstractLines: string[] = [];

  for (const { line } of allLines.slice(abstractIndex + 1)) {
    if (getSectionTitle(line)) {
      break;
    }

    abstractLines.push(line);
  }

  const abstract = abstractLines.join(" ").trim();
  return abstract.length > 0 ? abstract : null;
}

function isAbstractHeading(line: string): boolean {
  return normalizeHeading(line) === "abstract";
}

function getSectionTitle(line: string): string | null {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const numberedMatch = trimmed.match(/^(\d+(\.\d+)*)\.?\s+([A-Z][A-Za-z0-9 ,:&/-]{2,80})$/);

  if (numberedMatch?.[3]) {
    return numberedMatch[3].trim();
  }

  const normalized = normalizeHeading(trimmed);

  if (COMMON_SECTION_TITLES.includes(normalized)) {
    return trimmed;
  }

  return null;
}

function findReferenceStart(
  pages: ParsedPdfPage[]
): { pageNumber: number; lineIndex: number } | null {
  for (const page of pages) {
    const lines = getMeaningfulLines(page.text);
    const lineIndex = lines.findIndex((line) => {
      const normalized = normalizeHeading(line);

      return normalized === "references" || normalized === "bibliography";
    });

    if (lineIndex >= 0) {
      return { pageNumber: page.pageNumber, lineIndex };
    }
  }

  return null;
}

function splitReferenceEntries(referenceText: string): string[] {
  const entries: string[] = [];
  let current: string[] = [];

  for (const line of getMeaningfulLines(referenceText)) {
    const startsEntry = /^(\[\d+\]|\d+\.|\d+\s+)/.test(line);

    if (startsEntry && current.length > 0) {
      entries.push(current.join(" ").trim());
      current = [];
    }

    current.push(line.replace(/^(\[\d+\]|\d+\.|\d+\s+)/, "").trim());
  }

  if (current.length > 0) {
    entries.push(current.join(" ").trim());
  }

  return entries.filter((entry) => entry.length >= 10);
}

function extractReferenceTitle(rawText: string): string | null {
  const quoted = rawText.match(/[“"]([^”"]{8,180})[”"]/);

  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const parts = rawText.split(".");
  const title = parts.find((part) => part.trim().split(/\s+/).length >= 3);

  return title ? title.trim() : null;
}

function extractReferenceAuthors(rawText: string): string | null {
  const firstSentence = rawText.split(".")[0]?.trim();

  if (!firstSentence || firstSentence.length < 3 || firstSentence.length > 200) {
    return null;
  }

  return firstSentence;
}
