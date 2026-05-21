import { randomUUID } from "node:crypto";

import { getPrismaClient, type PrismaClient } from "@papertrail/db";

import { ConflictError, NotFoundError } from "@/server/errors/application-error";
import { ensureLocalUser } from "@/server/local/localUser";

import type { RetrievalResult } from "../retrieval/retrievalService";
import { createConfiguredRetrievalService, type RetrievedChunk } from "../retrieval/retrievalService";
import type { ChatProvider } from "./chatProvider";
import { createOpenAiCompatibleChatProvider } from "./openAiCompatibleChatProvider";
import {
  createChatProviderConfigFromSettings,
  createSettingsService
} from "../settings/settingsService";
import { buildGroundedAnswerMessages, GROUNDED_ANSWER_PROMPT_VERSION } from "./promptBuilder";
import {
  type AnswerCitation,
  createInsufficientEvidenceAnswer,
  type GroundedProviderClaim,
  GroundedAnswerValidationError,
  parseGroundedProviderPayload,
  type ValidatedGroundedAnswer,
  validateGroundedAnswerPayload
} from "./citations";

export type ChatScopeType = "PAPER" | "COLLECTION";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObjectValue = { [key: string]: JsonValue };

export type ChatServiceInput = {
  currentUserId: string;
  question: string;
  paperIds: string[];
  chatSessionId?: string;
  scopeType?: ChatScopeType;
};

export type ChatServiceResult = {
  answer: string;
  insufficientEvidence: boolean;
  citations: AnswerCitation[];
  chatSessionId: string;
  assistantMessageId: string;
};

export type ChatSessionRecord = {
  id: string;
  userId: string;
  scopeType: ChatScopeType;
};

export type ChatMessageRecord = {
  id: string;
};

export type ChatPaperRecord = {
  id: string;
  status: string;
};

export type ChatRepository = {
  findPapersForUser(input: { userId: string; paperIds: string[] }): Promise<ChatPaperRecord[]>;
  findChatSessionForUser(input: { userId: string; chatSessionId: string }): Promise<ChatSessionRecord | null>;
  createChatSession(input: {
    userId: string;
    paperIds: string[];
    scopeType: ChatScopeType;
    title: string;
  }): Promise<ChatSessionRecord>;
  createMessage(input: {
    chatSessionId: string;
    role: "USER" | "ASSISTANT";
    status: "SUCCEEDED" | "FAILED";
    content: string;
    model?: string | null;
    promptVersion?: string | null;
    retrievalMetadata?: JsonObjectValue | null;
    providerRequestId?: string | null;
    errorCode?: string | null;
  }): Promise<ChatMessageRecord>;
  persistAssistantEvidence(input: {
    assistantMessageId: string;
    citations: AnswerCitation[];
    citedClaims: GroundedProviderClaim[];
  }): Promise<void>;
};

export type RetrievalService = {
  retrieve(input: {
    userId: string;
    query: string;
    paperIds: string[];
    topK?: number;
  }): Promise<RetrievalResult>;
};

const DEFAULT_RETRY_TEMPERATURE = 0;

export function createChatService(
  repository: ChatRepository = createPrismaChatRepository(),
  retrievalService: RetrievalService = createConfiguredRetrievalService(getPrismaClient()),
  chatProvider?: ChatProvider
) {
  return {
    async answerQuestion(input: ChatServiceInput): Promise<ChatServiceResult> {
      const paperIds = unique(input.paperIds);
      const scopeType = input.scopeType ?? (paperIds.length === 1 ? "PAPER" : "COLLECTION");

      await assertPapersReadyForChat(repository, input.currentUserId, paperIds);
      const chatSession = await getOrCreateChatSession(repository, {
        currentUserId: input.currentUserId,
        chatSessionId: input.chatSessionId,
        paperIds,
        scopeType,
        question: input.question
      });

      await repository.createMessage({
        chatSessionId: chatSession.id,
        role: "USER",
        status: "SUCCEEDED",
        content: input.question
      });

      const retrieval = await retrievalService.retrieve({
        userId: input.currentUserId,
        query: input.question,
        paperIds
      });
      const configuredChatProvider = chatProvider ?? (await createLocalChatProvider());
      const groundedAnswer =
        retrieval.chunks.length === 0
          ? createInsufficientEvidenceAnswer(input.question)
          : await generateValidatedAnswer(configuredChatProvider, input.question, retrieval.chunks);

      const assistantMessage = await repository.createMessage({
        chatSessionId: chatSession.id,
        role: "ASSISTANT",
        status: "SUCCEEDED",
        content: groundedAnswer.answer,
        model: configuredChatProvider.model,
        promptVersion: GROUNDED_ANSWER_PROMPT_VERSION,
        retrievalMetadata: {
          selectedPaperIds: paperIds,
          embeddingModel: retrieval.embeddingModel,
          retrievedChunkIds: retrieval.chunks.map((chunk) => chunk.chunkId),
          similarityScores: Object.fromEntries(
            retrieval.chunks.map((chunk) => [chunk.chunkId, chunk.similarityScore])
          ),
          insufficientEvidence: groundedAnswer.insufficientEvidence
        },
        providerRequestId: null,
        errorCode: groundedAnswer.insufficientEvidence ? "INSUFFICIENT_EVIDENCE" : null
      });

      await repository.persistAssistantEvidence({
        assistantMessageId: assistantMessage.id,
        citations: groundedAnswer.citations,
        citedClaims: groundedAnswer.citedClaims
      });

      return {
        answer: groundedAnswer.answer,
        insufficientEvidence: groundedAnswer.insufficientEvidence,
        citations: groundedAnswer.citations,
        chatSessionId: chatSession.id,
        assistantMessageId: assistantMessage.id
      };
    }
  };
}

async function createLocalChatProvider(): Promise<ChatProvider> {
  const settings = await createSettingsService().requireProviderSettings();

  return createOpenAiCompatibleChatProvider(createChatProviderConfigFromSettings(settings));
}

export function createPrismaChatRepository(prisma: PrismaClient = getPrismaClient()): ChatRepository {
  return {
    findPapersForUser(input) {
      return prisma.paper.findMany({
        where: {
          userId: input.userId,
          id: { in: input.paperIds }
        },
        select: {
          id: true,
          status: true
        }
      });
    },
    findChatSessionForUser(input) {
      return prisma.chatSession.findFirst({
        where: {
          id: input.chatSessionId,
          userId: input.userId
        },
        select: {
          id: true,
          userId: true,
          scopeType: true
        }
      }).then((session) => (session ? { ...session, scopeType: session.scopeType as ChatScopeType } : null));
    },
    async createChatSession(input) {
      await ensureLocalUser(prisma);
      return prisma.chatSession.create({
        data: {
          userId: input.userId,
          title: input.title,
          scopeType: input.scopeType,
          papers: {
            create: input.paperIds.map((paperId) => ({ paperId }))
          }
        },
        select: {
          id: true,
          userId: true,
          scopeType: true
        }
      }).then((session) => ({ ...session, scopeType: session.scopeType as ChatScopeType }));
    },
    createMessage(input) {
      return prisma.chatMessage.create({
        data: {
          chatSessionId: input.chatSessionId,
          role: input.role,
          status: input.status,
          content: input.content,
          model: input.model,
          promptVersion: input.promptVersion,
          retrievalMetadata: input.retrievalMetadata ?? undefined,
          providerRequestId: input.providerRequestId,
          errorCode: input.errorCode
        },
        select: { id: true }
      });
    },
    async persistAssistantEvidence(input) {
      const citationIdsByChunkId = new Map<string, string>();

      for (const citation of input.citations) {
        const citationId = randomUUID();
        citationIdsByChunkId.set(citation.chunkId, citationId);
        await prisma.chatCitation.create({
          data: {
            id: citationId,
            chatMessageId: input.assistantMessageId,
            paperId: citation.paperId,
            chunkId: citation.chunkId,
            pageStart: citation.pageStart,
            pageEnd: citation.pageEnd,
            quote: citation.quote,
            label: citation.label
          }
        });
      }

      for (const [position, claim] of input.citedClaims.entries()) {
        const citationIds = claim.chunkIds
          .map((chunkId) => citationIdsByChunkId.get(chunkId))
          .filter((citationId): citationId is string => Boolean(citationId));

        if (citationIds.length === 0) {
          continue;
        }

        await prisma.chatCitedClaim.create({
          data: {
            chatMessageId: input.assistantMessageId,
            claimText: claim.claimText,
            citationIds,
            position
          }
        });
      }
    }
  };
}

async function generateValidatedAnswer(
  chatProvider: ChatProvider,
  question: string,
  chunks: RetrievedChunk[]
): Promise<ValidatedGroundedAnswer> {
  const first = await completeAndValidate(chatProvider, question, chunks);

  if (first.valid) {
    return first.answer;
  }

  const retry = await completeAndValidate(chatProvider, question, chunks, true);

  if (retry.valid) {
    return retry.answer;
  }

  return createInsufficientEvidenceAnswer(question);
}

async function completeAndValidate(
  chatProvider: ChatProvider,
  question: string,
  chunks: RetrievedChunk[],
  retry = false
): Promise<{ valid: true; answer: ValidatedGroundedAnswer } | { valid: false }> {
  try {
    const messages = buildGroundedAnswerMessages({ question, chunks });
    const systemMessage = messages[0];
    const userMessage = messages[1];

    if (!systemMessage || !userMessage) {
      throw new GroundedAnswerValidationError("Grounded answer prompt was not constructed correctly.");
    }

    const response = await chatProvider.complete({
      messages: retry
        ? [
            systemMessage,
            {
              role: "user",
              content: `${userMessage.content}\n\nYour previous response cited invalid or missing chunk IDs. Return JSON that cites only the listed Chunk ID values, or set insufficientEvidence true.`
            }
          ]
        : messages,
      responseFormat: "json",
      temperature: DEFAULT_RETRY_TEMPERATURE
    });
    const payload = parseGroundedProviderPayload(response.content);

    return {
      valid: true,
      answer: validateGroundedAnswerPayload(payload, chunks)
    };
  } catch (error) {
    if (error instanceof GroundedAnswerValidationError) {
      return { valid: false };
    }

    throw error;
  }
}

async function assertPapersReadyForChat(
  repository: ChatRepository,
  userId: string,
  paperIds: string[]
): Promise<void> {
  const papers = await repository.findPapersForUser({ userId, paperIds });
  const found = new Set(papers.map((paper) => paper.id));

  if (papers.length !== paperIds.length) {
    const missingPaperId = paperIds.find((paperId) => !found.has(paperId));
    throw new NotFoundError("Paper not found.", { paperId: missingPaperId });
  }

  const notReadyPaper = papers.find((paper) => paper.status !== "READY");

  if (notReadyPaper) {
    throw new ConflictError("Paper is not ready for chat.", {
      paperId: notReadyPaper.id,
      status: notReadyPaper.status
    });
  }
}

async function getOrCreateChatSession(
  repository: ChatRepository,
  input: {
    currentUserId: string;
    chatSessionId?: string;
    paperIds: string[];
    scopeType: ChatScopeType;
    question: string;
  }
): Promise<ChatSessionRecord> {
  if (input.chatSessionId) {
    const session = await repository.findChatSessionForUser({
      userId: input.currentUserId,
      chatSessionId: input.chatSessionId
    });

    if (!session) {
      throw new NotFoundError("Chat session not found.", { chatSessionId: input.chatSessionId });
    }

    return session;
  }

  return repository.createChatSession({
    userId: input.currentUserId,
    paperIds: input.paperIds,
    scopeType: input.scopeType,
    title: createChatTitle(input.question)
  });
}

function createChatTitle(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();

  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 79).trimEnd()}...`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
