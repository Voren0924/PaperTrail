import { describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "@/server/errors/application-error";

import type { ChatProvider } from "./chatProvider";
import {
  createChatService,
  type ChatRepository,
  type ChatSessionRecord,
  type RetrievalService
} from "./chatService";
import { createRetrievedChunk } from "./test-helpers";

describe("chat service", () => {
  it("persists messages, citations, and cited claims for a grounded answer", async () => {
    const repository = createMemoryRepository();
    const retrievalService = createRetrievalService([createRetrievedChunk({ chunkId: "chunk-1" })]);
    const { provider } = createProvider([
      {
        answer: "The paper proposes a retrieval method.",
        insufficientEvidence: false,
        citedClaims: [{ claimText: "The paper proposes a retrieval method.", chunkIds: ["chunk-1"] }]
      }
    ]);
    const service = createChatService(repository, retrievalService, provider);

    await expect(
      service.answerQuestion({
        currentUserId: "user-1",
        question: "What is the method?",
        paperIds: ["paper-1"]
      })
    ).resolves.toMatchObject({
      answer: "The paper proposes a retrieval method.",
      insufficientEvidence: false,
      chatSessionId: "session-1",
      assistantMessageId: "message-2",
      citations: [{ chunkId: "chunk-1" }]
    });
    expect(repository.messages.map((message) => message.role)).toEqual(["USER", "ASSISTANT"]);
    expect(repository.persistedEvidence).toHaveLength(1);
    expect(repository.persistedEvidence[0]?.citations).toHaveLength(1);
    expect(repository.persistedEvidence[0]?.citedClaims).toHaveLength(1);
  });

  it("returns frontend-compatible citation metadata derived from retrieved chunks", async () => {
    const repository = createMemoryRepository();
    const retrievalService = createRetrievalService([
      createRetrievedChunk({
        paperId: "paper-1",
        chunkId: "chunk-42",
        pageStart: 4,
        pageEnd: 6,
        sectionTitle: "Evaluation",
        text: "The evaluation chunk contains benchmark evidence and ablation details.",
        similarityScore: 0.87
      })
    ]);
    const { provider } = createProvider([
      {
        answer: "The paper evaluates the method with benchmarks.",
        insufficientEvidence: false,
        citedClaims: [{ claimText: "The paper evaluates the method with benchmarks.", chunkIds: ["chunk-42"] }]
      }
    ]);
    const service = createChatService(repository, retrievalService, provider);

    const result = await service.answerQuestion({
      currentUserId: "user-1",
      question: "How is the method evaluated?",
      paperIds: ["paper-1"]
    });

    expect(result.citations).toEqual([
      {
        paperId: "paper-1",
        chunkId: "chunk-42",
        pageStart: 4,
        pageEnd: 6,
        sectionTitle: "Evaluation",
        text: "The evaluation chunk contains benchmark evidence and ablation details.",
        similarityScore: 0.87,
        label: "[paper-1, pp. 4-6]",
        quote: "The evaluation chunk contains benchmark evidence and ablation details."
      }
    ]);
  });

  it("returns insufficient evidence without calling the provider when retrieval is empty", async () => {
    const repository = createMemoryRepository();
    const retrievalService = createRetrievalService([]);
    const { provider, complete } = createProvider([]);
    const service = createChatService(repository, retrievalService, provider);

    await expect(
      service.answerQuestion({
        currentUserId: "user-1",
        question: "What is the limitation?",
        paperIds: ["paper-1"]
      })
    ).resolves.toMatchObject({
      insufficientEvidence: true,
      citations: []
    });
    expect(complete).not.toHaveBeenCalled();
    expect(repository.messages.at(-1)).toMatchObject({
      role: "ASSISTANT",
      errorCode: "INSUFFICIENT_EVIDENCE"
    });
  });

  it("retries invalid citations once and falls back to insufficient evidence", async () => {
    const repository = createMemoryRepository();
    const retrievalService = createRetrievalService([createRetrievedChunk({ chunkId: "chunk-1" })]);
    const { provider, complete } = createProvider([
      {
        answer: "Unsupported claim.",
        insufficientEvidence: false,
        citedClaims: [{ claimText: "Unsupported claim.", chunkIds: ["chunk-missing"] }]
      },
      {
        answer: "Still unsupported.",
        insufficientEvidence: false,
        citedClaims: []
      }
    ]);
    const service = createChatService(repository, retrievalService, provider);

    await expect(
      service.answerQuestion({
        currentUserId: "user-1",
        question: "What is the method?",
        paperIds: ["paper-1"]
      })
    ).resolves.toMatchObject({
      insufficientEvidence: true,
      citations: []
    });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("rejects papers not owned by the current user", async () => {
    const repository = createMemoryRepository({ papers: [] });
    const service = createChatService(repository, createRetrievalService([]), createProvider([]).provider);

    await expect(
      service.answerQuestion({
        currentUserId: "user-1",
        question: "Question",
        paperIds: ["paper-2"]
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects papers that are not ready", async () => {
    const repository = createMemoryRepository({ papers: [{ id: "paper-1", status: "PARSING" }] });
    const service = createChatService(repository, createRetrievalService([]), createProvider([]).provider);

    await expect(
      service.answerQuestion({
        currentUserId: "user-1",
        question: "Question",
        paperIds: ["paper-1"]
      })
    ).rejects.toThrow(ConflictError);
  });

  it("reuses only chat sessions owned by the current user", async () => {
    const repository = createMemoryRepository({ sessions: [] });
    const service = createChatService(repository, createRetrievalService([]), createProvider([]).provider);

    await expect(
      service.answerQuestion({
        currentUserId: "user-1",
        chatSessionId: "missing-session",
        question: "Question",
        paperIds: ["paper-1"]
      })
    ).rejects.toThrow(NotFoundError);
  });
});

function createMemoryRepository(input: {
  papers?: Array<{ id: string; status: string }>;
  sessions?: ChatSessionRecord[];
} = {}): ChatRepository & {
  messages: Array<{
    chatSessionId: string;
    role: "USER" | "ASSISTANT";
    status: "SUCCEEDED" | "FAILED";
    content: string;
    errorCode?: string | null;
  }>;
  persistedEvidence: Array<Parameters<ChatRepository["persistAssistantEvidence"]>[0]>;
} {
  const papers = input.papers ?? [{ id: "paper-1", status: "READY" }];
  const sessions = input.sessions ?? [];
  const messages: Array<{
    chatSessionId: string;
    role: "USER" | "ASSISTANT";
    status: "SUCCEEDED" | "FAILED";
    content: string;
    errorCode?: string | null;
  }> = [];
  const persistedEvidence: Array<Parameters<ChatRepository["persistAssistantEvidence"]>[0]> = [];

  return {
    messages,
    persistedEvidence,
    findPapersForUser(request) {
      const requested = new Set(request.paperIds);
      return Promise.resolve(papers.filter((paper) => requested.has(paper.id)));
    },
    findChatSessionForUser(request) {
      return Promise.resolve(
        sessions.find((session) => session.id === request.chatSessionId && session.userId === request.userId) ?? null
      );
    },
    createChatSession(request) {
      const session = {
        id: `session-${sessions.length + 1}`,
        userId: request.userId,
        scopeType: request.scopeType
      };
      sessions.push(session);

      return Promise.resolve(session);
    },
    createMessage(request) {
      messages.push(request);

      return Promise.resolve({ id: `message-${messages.length}` });
    },
    persistAssistantEvidence(request) {
      persistedEvidence.push(request);
      return Promise.resolve();
    }
  };
}

function createRetrievalService(chunks: ReturnType<typeof createRetrievedChunk>[]): RetrievalService {
  return {
    retrieve: (input) =>
      Promise.resolve({
        query: input.query,
        paperIds: input.paperIds,
        embeddingModel: "embedding-model",
        topK: 8,
        chunks
      })
  };
}

function createProvider(
  payloads: Array<{
    answer: string;
    insufficientEvidence: boolean;
    citedClaims?: Array<{ claimText: string; chunkIds: string[] }>;
  }>
): {
  provider: ChatProvider;
  complete: ReturnType<typeof vi.fn<ChatProvider["complete"]>>;
} {
  const queue = [...payloads];
  const complete = vi.fn<ChatProvider["complete"]>(() => {
    const payload = queue.shift() ?? {
      answer: "Not enough evidence.",
      insufficientEvidence: true,
      citedClaims: []
    };

    return Promise.resolve({
      content: JSON.stringify(payload),
      model: "chat-model",
      providerRequestId: "provider-response-1"
    });
  });

  return {
    provider: {
      name: "openai-compatible",
      model: "chat-model",
      complete
    },
    complete
  };
}
