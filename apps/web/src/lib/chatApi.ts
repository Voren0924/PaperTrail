import { apiRequest } from "./api";
import type { ChatResponse } from "./types";

export type AskPaperQuestionInput = {
  paperId: string;
  question: string;
  chatSessionId?: string;
};

export function askPaperQuestion(input: AskPaperQuestionInput): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      paperIds: [input.paperId],
      question: input.question,
      scopeType: "PAPER",
      ...(input.chatSessionId ? { chatSessionId: input.chatSessionId } : {})
    })
  });
}
