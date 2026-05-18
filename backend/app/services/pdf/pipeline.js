const { parsePdf } = require("./parser");
const { chunkParsedPdf } = require("./chunker");

function parseAndChunkPdf(buffer, options = {}) {
  const parsed = parsePdf(buffer, options.parser);
  const chunks = chunkParsedPdf(parsed, options.chunker);

  if (parsed.diagnostics.likelyScanned) {
    return {
      ...parsed,
      chunks,
      ready: false,
      failureReason: "The PDF appears to be scanned or has too little extractable text for reliable Q&A.",
    };
  }

  if (chunks.length === 0) {
    return {
      ...parsed,
      chunks,
      ready: false,
      failureReason: "No meaningful chunks could be produced from the extracted PDF text.",
    };
  }

  return {
    ...parsed,
    chunks,
    ready: true,
    failureReason: null,
  };
}

module.exports = {
  parseAndChunkPdf,
};
