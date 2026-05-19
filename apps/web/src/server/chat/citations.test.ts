import { describe, expect, it } from "vitest";

import {
  createQuotePreview,
  formatCitationLabel,
  GroundedAnswerValidationError,
  parseGroundedProviderPayload,
  validateGroundedAnswerPayload
} from "./citations";
import { createRetrievedChunk } from "./test-helpers";

describe("grounded answer citations", () => {
  it("rejects citations for chunks that were not retrieved", () => {
    const payload = {
      answer: "The paper uses a method.",
      insufficientEvidence: false,
      citedClaims: [{ claimText: "The paper uses a method.", chunkIds: ["chunk-missing"] }]
    };

    expect(() => validateGroundedAnswerPayload(payload, [createRetrievedChunk({ chunkId: "chunk-1" })])).toThrow(
      GroundedAnswerValidationError
    );
  });

  it("returns citation metadata for retrieved chunks", () => {
    const result = validateGroundedAnswerPayload(
      {
        answer: "The paper uses a method.",
        insufficientEvidence: false,
        citedClaims: [{ claimText: "The paper uses a method.", chunkIds: ["chunk-1"] }]
      },
      [createRetrievedChunk({ chunkId: "chunk-1", pageStart: 2, pageEnd: 3 })]
    );

    expect(result.citations).toMatchObject([
      {
        chunkId: "chunk-1",
        pageStart: 2,
        pageEnd: 3,
        label: "[paper-1, pp. 2-3]"
      }
    ]);
  });

  it("parses valid provider JSON and normalizes empty cited claims", () => {
    expect(
      parseGroundedProviderPayload(
        JSON.stringify({
          answer: "Not enough evidence.",
          insufficientEvidence: true
        })
      )
    ).toEqual({
      answer: "Not enough evidence.",
      insufficientEvidence: true,
      citedClaims: []
    });
  });

  it("formats citation labels and quote previews", () => {
    expect(formatCitationLabel({ paperId: "paper-1", pageStart: 4, pageEnd: 4 })).toBe("[paper-1, p. 4]");
    expect(createQuotePreview("a ".repeat(200)).length).toBeLessThanOrEqual(283);
  });
});
