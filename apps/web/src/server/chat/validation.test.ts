import { describe, expect, it } from "vitest";

import { ValidationError } from "@/server/errors/application-error";

import { validateChatRequest } from "./validation";

describe("chat request validation", () => {
  it("accepts a single paperId request", () => {
    expect(
      validateChatRequest({
        question: " What is the contribution? ",
        paperId: "paper-1",
        scopeType: "PAPER"
      })
    ).toEqual({
      question: "What is the contribution?",
      paperIds: ["paper-1"],
      scopeType: "PAPER"
    });
  });

  it("accepts selected paper IDs and deduplicates them", () => {
    expect(
      validateChatRequest({
        question: "Compare methods",
        paperIds: ["paper-1", "paper-1", "paper-2"],
        scopeType: "COLLECTION"
      }).paperIds
    ).toEqual(["paper-1", "paper-2"]);
  });

  it("rejects missing question or paper scope", () => {
    expect(() => validateChatRequest({ question: "", paperIds: [] })).toThrow(ValidationError);
  });

  it("rejects PAPER scope with multiple paper IDs", () => {
    expect(() =>
      validateChatRequest({
        question: "Question",
        paperIds: ["paper-1", "paper-2"],
        scopeType: "PAPER"
      })
    ).toThrow(ValidationError);
  });
});
