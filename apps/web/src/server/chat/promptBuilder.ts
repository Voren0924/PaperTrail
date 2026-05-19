import type { RetrievedChunk } from "../retrieval/retrievalService";
import type { ChatProviderMessage } from "./chatProvider";

export const GROUNDED_ANSWER_PROMPT_VERSION = "grounded-answer-v1";

export type BuildGroundedAnswerPromptInput = {
  question: string;
  chunks: RetrievedChunk[];
};

export function buildGroundedAnswerMessages(input: BuildGroundedAnswerPromptInput): ChatProviderMessage[] {
  return [
    {
      role: "system",
      content: [
        "You answer questions about academic papers using only the supplied evidence chunks.",
        "Do not use outside knowledge for factual paper-specific claims.",
        "If the evidence is insufficient, return insufficientEvidence true and a brief explanation.",
        "Every factual answer must cite retrieved chunk IDs only.",
        "Return JSON with this shape:",
        "{\"answer\":\"...\",\"insufficientEvidence\":false,\"citedClaims\":[{\"claimText\":\"...\",\"chunkIds\":[\"chunk-id\"]}]}"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Question: ${input.question}`,
        "",
        "Evidence chunks:",
        formatEvidenceChunks(input.chunks)
      ].join("\n")
    }
  ];
}

export function formatEvidenceChunks(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) =>
      [
        `Evidence ${index + 1}`,
        `Chunk ID: ${chunk.chunkId}`,
        `Paper ID: ${chunk.paperId}`,
        `Pages: ${chunk.pageStart}-${chunk.pageEnd}`,
        `Section: ${chunk.sectionTitle ?? "Unknown"}`,
        `Similarity: ${chunk.similarityScore.toFixed(4)}`,
        "Text:",
        chunk.text
      ].join("\n")
    )
    .join("\n\n");
}
