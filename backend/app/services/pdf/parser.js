const zlib = require("node:zlib");

const DEFAULT_MIN_PAGE_CHARS = 80;

function parsePdf(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("parsePdf expects a Buffer.");
  }

  const source = buffer.toString("latin1");
  if (!source.startsWith("%PDF-")) {
    throw new Error("Input is not a PDF document.");
  }

  const pageCount = countPdfPages(source);
  const streamTexts = extractContentStreamTexts(source);
  const pages = assignStreamsToPages(streamTexts, pageCount).map((text, index) => {
    const normalizedText = normalizeExtractedText(text);
    return {
      pageNumber: index + 1,
      text: normalizedText,
      charCount: normalizedText.length,
      likelyScanned: normalizedText.length < (options.minPageChars || DEFAULT_MIN_PAGE_CHARS),
    };
  });

  const diagnostics = buildDiagnostics(pages, options);
  const combinedText = pages.map((page) => page.text).join("\n\n");
  const sections = extractSections(pages);
  const references = extractReferences(pages, sections);

  return {
    pageCount: pageCount || pages.length,
    pages,
    metadata: {
      title: extractTitle(pages[0]?.text || ""),
      abstract: extractAbstract(combinedText),
    },
    sections,
    references,
    diagnostics,
  };
}

function countPdfPages(source) {
  const matches = source.match(/\/Type\s*\/Page(?!s)\b/g);
  return matches ? matches.length : 0;
}

function extractContentStreamTexts(source) {
  const streamPattern = /<<(?:.|\r|\n)*?>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  const texts = [];
  let match;

  while ((match = streamPattern.exec(source)) !== null) {
    const dictionary = match[0].slice(0, match[0].indexOf("stream"));
    const rawStream = Buffer.from(match[1], "latin1");
    const decoded = decodeStream(rawStream, dictionary);
    const text = extractTextFromContentStream(decoded.toString("latin1"));
    if (text.trim()) {
      texts.push(text);
    }
  }

  return texts;
}

function decodeStream(rawStream, dictionary) {
  if (!/\/Filter\s*(?:\[)?\s*\/FlateDecode\b/.test(dictionary)) {
    return rawStream;
  }

  try {
    return zlib.inflateSync(rawStream);
  } catch (_error) {
    try {
      return zlib.inflateRawSync(rawStream);
    } catch {
      return Buffer.alloc(0);
    }
  }
}

function extractTextFromContentStream(content) {
  const textObjects = content.match(/BT[\s\S]*?ET/g) || [];
  const lines = [];

  for (const object of textObjects) {
    lines.push(...extractTextObjectLines(object));
  }

  return lines.join("\n");
}

function extractTextObjectLines(textObject) {
  const lines = [];
  let currentLine = [];
  let index = 0;

  while (index < textObject.length) {
    const char = textObject[index];
    if (char === "(") {
      const parsed = parseLiteralString(textObject, index);
      currentLine.push(parsed.value);
      index = parsed.endIndex;
      continue;
    }

    if (char === "<" && textObject[index + 1] !== "<") {
      const parsed = parseHexString(textObject, index);
      currentLine.push(parsed.value);
      index = parsed.endIndex;
      continue;
    }

    if (textObject.startsWith("T*", index) || textObject.startsWith("'", index) || textObject.startsWith('"', index)) {
      pushLine(lines, currentLine);
      currentLine = [];
      index += 1;
      continue;
    }

    if (textObject.startsWith("Td", index) || textObject.startsWith("TD", index)) {
      pushLine(lines, currentLine);
      currentLine = [];
      index += 2;
      continue;
    }

    index += 1;
  }

  pushLine(lines, currentLine);
  return lines;
}

function parseLiteralString(input, startIndex) {
  let depth = 1;
  let index = startIndex + 1;
  let value = "";

  while (index < input.length && depth > 0) {
    const char = input[index];

    if (char === "\\") {
      const next = input[index + 1];
      if (next === "\r" || next === "\n") {
        index += next === "\r" && input[index + 2] === "\n" ? 3 : 2;
        continue;
      }
      if (/[0-7]/.test(next || "")) {
        const octal = input.slice(index + 1).match(/^[0-7]{1,3}/)[0];
        value += String.fromCharCode(Number.parseInt(octal, 8));
        index += octal.length + 1;
        continue;
      }

      value += decodeEscapedChar(next);
      index += 2;
      continue;
    }

    if (char === "(") {
      depth += 1;
      value += char;
      index += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth > 0) {
        value += char;
      }
      index += 1;
      continue;
    }

    value += char;
    index += 1;
  }

  return { value, endIndex: index };
}

function parseHexString(input, startIndex) {
  const endIndex = input.indexOf(">", startIndex + 1);
  if (endIndex === -1) {
    return { value: "", endIndex: input.length };
  }

  let hex = input.slice(startIndex + 1, endIndex).replace(/\s+/g, "");
  if (hex.length % 2 === 1) {
    hex += "0";
  }

  const bytes = Buffer.from(hex, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let value = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      value += String.fromCharCode(bytes.readUInt16BE(index));
    }
    return { value, endIndex: endIndex + 1 };
  }

  return { value: bytes.toString("latin1"), endIndex: endIndex + 1 };
}

function decodeEscapedChar(char) {
  switch (char) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "(":
    case ")":
    case "\\":
      return char;
    default:
      return char || "";
  }
}

function pushLine(lines, parts) {
  const line = parts.join("").replace(/\s+/g, " ").trim();
  if (line) {
    lines.push(line);
  }
}

function assignStreamsToPages(streamTexts, pageCount) {
  if (pageCount <= 0) {
    return streamTexts;
  }

  const pages = Array.from({ length: pageCount }, () => []);
  streamTexts.forEach((text, index) => {
    const pageIndex = Math.min(index, pageCount - 1);
    pages[pageIndex].push(text);
  });

  return pages.map((parts) => parts.join("\n"));
}

function normalizeExtractedText(text) {
  return text
    .replace(/\u00ad/g, "")
    .replace(/\ufb00/g, "ff")
    .replace(/\ufb01/g, "fi")
    .replace(/\ufb02/g, "fl")
    .replace(/\ufb03/g, "ffi")
    .replace(/\ufb04/g, "ffl")
    .replace(/-\s*\n\s*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildDiagnostics(pages, options) {
  const minPageChars = options.minPageChars || DEFAULT_MIN_PAGE_CHARS;
  const lowTextPages = pages.filter((page) => page.charCount < minPageChars).map((page) => page.pageNumber);
  const warnings = [];

  if (pages.length > 0 && lowTextPages.length / pages.length > 0.5) {
    warnings.push({
      code: "LOW_TEXT_DENSITY",
      message: "Most pages have very little extractable text; the PDF may be scanned or extraction may have failed.",
      pages: lowTextPages,
    });
  }

  if (hasLikelyTextOrderingIssue(pages)) {
    warnings.push({
      code: "POSSIBLE_TEXT_ORDERING_ISSUE",
      message: "Extracted text contains many single-character lines, which can indicate poor PDF text ordering.",
      pages: [],
    });
  }

  return {
    lowTextPages,
    likelyScanned: pages.length > 0 && lowTextPages.length / pages.length > 0.5,
    warnings,
  };
}

function hasLikelyTextOrderingIssue(pages) {
  const lines = pages.flatMap((page) => page.text.split(/\n+/));
  if (lines.length < 20) {
    return false;
  }

  const singleCharacterLines = lines.filter((line) => line.trim().length === 1).length;
  return singleCharacterLines / lines.length > 0.35;
}

function extractTitle(firstPageText) {
  const lines = firstPageText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => {
    return line.length >= 8 && !/^abstract$/i.test(line) && !/^\d+\s+/.test(line);
  }) || null;
}

function extractAbstract(text) {
  const match = text.match(/\bAbstract\b\s*[:.\-]?\s*([\s\S]*?)(?=\n\s*(?:\d+\.?\s+)?(?:Introduction|Related Work|Background|Method|Methods|Approach|Experiments|Evaluation|Results|Conclusion)\b)/i);
  return match ? normalizeExtractedText(match[1]) : null;
}

function extractSections(pages) {
  const sections = [];
  let position = 0;

  for (const page of pages) {
    const lines = page.text.split(/\n+/);
    for (const line of lines) {
      const title = normalizeSectionHeading(line);
      if (!title) {
        continue;
      }

      sections.push({
        title,
        normalizedTitle: title.toLowerCase(),
        startPage: page.pageNumber,
        endPage: page.pageNumber,
        position,
      });
      position += 1;
    }
  }

  for (let index = 0; index < sections.length; index += 1) {
    sections[index].endPage = sections[index + 1]?.startPage || pages.length || sections[index].startPage;
  }

  return sections;
}

function normalizeSectionHeading(line) {
  const trimmed = line.trim().replace(/\s+/g, " ");
  if (trimmed.length > 90) {
    return null;
  }

  const numbered = trimmed.match(/^(?:\d+(?:\.\d+)*\.?)\s+([A-Z][A-Za-z0-9,()\- ]{2,})$/);
  if (numbered) {
    return numbered[1].trim();
  }

  const commonHeading = trimmed.match(/^(Abstract|Introduction|Background|Related Work|Method|Methods|Methodology|Approach|Implementation|Experiments|Evaluation|Results|Discussion|Limitations|Conclusion|References|Bibliography)$/i);
  if (commonHeading) {
    return commonHeading[1].replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return null;
}

function extractReferences(pages, sections) {
  const referenceSection = sections.find((section) => /^(references|bibliography)$/i.test(section.title));
  if (!referenceSection) {
    return [];
  }

  const referenceText = pages
    .filter((page) => page.pageNumber >= referenceSection.startPage)
    .map((page) => page.text)
    .join("\n");

  const body = referenceText.replace(/^[\s\S]*?\b(?:References|Bibliography)\b\s*/i, "");
  return body
    .split(/\n(?=\s*(?:\[\d+\]|\d+\.|\w.+\(\d{4}\)))/)
    .map((rawText) => rawText.trim())
    .filter((rawText) => rawText.length > 20)
    .map((rawText, position) => ({ rawText, position }));
}

module.exports = {
  parsePdf,
  normalizeExtractedText,
  extractAbstract,
  extractSections,
};
