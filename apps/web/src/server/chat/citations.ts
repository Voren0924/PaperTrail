import type { RetrievedChunk } from "../retrieval/retrievalService";

export type GroundedProviderPayload = {
  answer: string;
  insufficientEvidence: boolean;
  citedClaims: GroundedProviderClaim[];
};

export type GroundedProviderClaim = {
  claimText: string;
  chunkIds: string[];
};

export type AnswerCitation = {
  paperId: string;
  chunkId: string;
  pageStart: number;
  pageEnd: number;
  sectionTitle: string | null;
  text: string;
  similarityScore: number;
  label: string;
  quote: string;
};

export type ValidatedGroundedAnswer = {
  answer: string;
  insufficientEvidence: boolean;
  citedClaims: GroundedProviderClaim[];
  citations: AnswerCitation[];
};

export class GroundedAnswerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundedAnswerValidationError";
  }
}

export function parseGroundedProviderPayload(rawContent: string): GroundedProviderPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new GroundedAnswerValidationError("Chat provider did not return valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new GroundedAnswerValidationError("Chat provider returned an invalid answer payload.");
  }

  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  const insufficientEvidence = parsed.insufficientEvidence === true;
  const citedClaims = parseCitedClaims(parsed.citedClaims);

  if (!answer) {
    throw new GroundedAnswerValidationError("Chat provider returned an empty answer.");
  }

  return {
    answer,
    insufficientEvidence,
    citedClaims
  };
}

export function validateGroundedAnswerPayload(
  payload: GroundedProviderPayload,
  retrievedChunks: RetrievedChunk[]
): ValidatedGroundedAnswer {
  if (payload.insufficientEvidence) {
    return {
      answer: payload.answer,
      insufficientEvidence: true,
      citedClaims: [],
      citations: []
    };
  }

  const chunkById = new Map(retrievedChunks.map((chunk) => [chunk.chunkId, chunk]));
  const citedChunkIds = unique(payload.citedClaims.flatMap((claim) => claim.chunkIds));

  if (citedChunkIds.length === 0) {
    throw new GroundedAnswerValidationError("Grounded answer did not include any citations.");
  }

  for (const chunkId of citedChunkIds) {
    if (!chunkById.has(chunkId)) {
      throw new GroundedAnswerValidationError(`Grounded answer cited an unretrieved chunk: ${chunkId}.`);
    }
  }

  return {
    answer: payload.answer,
    insufficientEvidence: false,
    citedClaims: payload.citedClaims,
    citations: citedChunkIds.map((chunkId) => toAnswerCitation(chunkById.get(chunkId)!))
  };
}

export function createInsufficientEvidenceAnswer(question: string): ValidatedGroundedAnswer {
  return {
    answer: `I do not have enough retrieved evidence to answer this question: ${question}`,
    insufficientEvidence: true,
    citedClaims: [],
    citations: []
  };
}

export function toAnswerCitation(chunk: RetrievedChunk): AnswerCitation {
  return {
    paperId: chunk.paperId,
    chunkId: chunk.chunkId,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    sectionTitle: chunk.sectionTitle,
    text: chunk.text,
    similarityScore: chunk.similarityScore,
    label: formatCitationLabel(chunk),
    quote: createQuotePreview(chunk.text)
  };
}

export function formatCitationLabel(chunk: Pick<RetrievedChunk, "paperId" | "pageStart" | "pageEnd">): string {
  const pages = chunk.pageStart === chunk.pageEnd ? `p. ${chunk.pageStart}` : `pp. ${chunk.pageStart}-${chunk.pageEnd}`;

  return `[${chunk.paperId}, ${pages}]`;
}

export function createQuotePreview(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function parseCitedClaims(value: unknown): GroundedProviderClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((claim) => ({
      claimText: typeof claim.claimText === "string" ? claim.claimText.trim() : "",
      chunkIds: Array.isArray(claim.chunkIds)
        ? unique(claim.chunkIds.filter((chunkId): chunkId is string => typeof chunkId === "string"))
        : []
    }))
    .filter((claim) => claim.claimText && claim.chunkIds.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
