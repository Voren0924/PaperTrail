import { ValidationError } from "@/server/errors/application-error";
import type { JsonObject } from "@/server/validation/request";

export type ChatRequestInput = {
  question: string;
  paperIds: string[];
  chatSessionId?: string;
  scopeType?: "PAPER" | "COLLECTION";
};

export function validateChatRequest(input: JsonObject): ChatRequestInput {
  const fields: Record<string, string> = {};
  const question = typeof input.question === "string" ? input.question.trim() : "";
  const chatSessionId = typeof input.chatSessionId === "string" ? input.chatSessionId.trim() : undefined;
  const paperIds = parsePaperIds(input);
  const scopeType = parseScopeType(input.scopeType);

  if (!question) {
    fields.question = "Question is required.";
  } else if (question.length > 4000) {
    fields.question = "Question must be at most 4000 characters.";
  }

  if (paperIds.length === 0) {
    fields.paperIds = "At least one paperId is required.";
  }

  if (scopeType && scopeType === "PAPER" && paperIds.length !== 1) {
    fields.scopeType = "PAPER scope requires exactly one paperId.";
  }

  if (input.scopeType !== undefined && !scopeType) {
    fields.scopeType = "scopeType must be PAPER or COLLECTION.";
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError(fields);
  }

  return {
    question,
    paperIds,
    ...(chatSessionId ? { chatSessionId } : {}),
    ...(scopeType ? { scopeType } : {})
  };
}

function parsePaperIds(input: JsonObject): string[] {
  if (typeof input.paperId === "string" && input.paperId.trim()) {
    return [input.paperId.trim()];
  }

  if (Array.isArray(input.paperIds)) {
    return [...new Set(input.paperIds.filter((paperId): paperId is string => typeof paperId === "string").map((id) => id.trim()).filter(Boolean))];
  }

  return [];
}

function parseScopeType(value: unknown): "PAPER" | "COLLECTION" | null {
  return value === "PAPER" || value === "COLLECTION" ? value : null;
}
