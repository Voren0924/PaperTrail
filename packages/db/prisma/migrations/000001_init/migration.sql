CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "PaperStatus" AS ENUM ('UPLOADED', 'PARSING', 'EMBEDDING', 'READY', 'FAILED');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "JobType" AS ENUM ('PARSE_PAPER', 'EMBED_PAPER', 'RETRY_PAPER');
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ChatScopeType" AS ENUM ('PAPER', 'COLLECTION');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Paper" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "abstract" TEXT,
    "publicationYear" INTEGER,
    "venue" TEXT,
    "doi" TEXT,
    "sourceUrl" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "pageCount" INTEGER,
    "status" "PaperStatus" NOT NULL DEFAULT 'UPLOADED',
    "statusMessage" TEXT,
    "metadataConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperAuthor" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PaperAuthor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperPage" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperSection" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "startPage" INTEGER,
    "endPage" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PaperSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperChunk" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "sectionId" UUID,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "startPage" INTEGER NOT NULL,
    "endPage" INTEGER NOT NULL,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "pageTextOffsets" JSONB,
    "contentHash" TEXT NOT NULL,
    "chunkVersion" INTEGER NOT NULL,
    "embedding" vector(1536),
    "embeddingModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperReference" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "rawText" TEXT NOT NULL,
    "title" TEXT,
    "authorsText" TEXT,
    "year" INTEGER,
    "venue" TEXT,
    "doi" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PaperReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "scopeType" "ChatScopeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSessionPaper" (
    "id" UUID NOT NULL,
    "chatSessionId" UUID NOT NULL,
    "paperId" UUID NOT NULL,

    CONSTRAINT "ChatSessionPaper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "chatSessionId" UUID NOT NULL,
    "role" "ChatRole" NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "temperature" DOUBLE PRECISION,
    "retrievalMetadata" JSONB,
    "providerRequestId" TEXT,
    "llmTraceId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatCitation" (
    "id" UUID NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "quote" TEXT,
    "label" TEXT NOT NULL,

    CONSTRAINT "ChatCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatCitedClaim" (
    "id" UUID NOT NULL,
    "chatMessageId" UUID NOT NULL,
    "claimText" TEXT NOT NULL,
    "citationIds" JSONB NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ChatCitedClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchNote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchNoteCitation" (
    "id" UUID NOT NULL,
    "researchNoteId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "chunkId" UUID,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "quote" TEXT,

    CONSTRAINT "ResearchNoteCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "paperId" UUID,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_sessionTokenHash_key" ON "Session"("sessionTokenHash");
CREATE UNIQUE INDEX "PaperPage_paperId_pageNumber_key" ON "PaperPage"("paperId", "pageNumber");
CREATE UNIQUE INDEX "ChatSessionPaper_chatSessionId_paperId_key" ON "ChatSessionPaper"("chatSessionId", "paperId");

CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Paper_userId_createdAt_idx" ON "Paper"("userId", "createdAt");
CREATE INDEX "Paper_userId_status_idx" ON "Paper"("userId", "status");
CREATE INDEX "Paper_fileSha256_idx" ON "Paper"("fileSha256");
CREATE INDEX "PaperAuthor_paperId_position_idx" ON "PaperAuthor"("paperId", "position");
CREATE INDEX "PaperSection_paperId_position_idx" ON "PaperSection"("paperId", "position");
CREATE INDEX "PaperChunk_paperId_chunkIndex_idx" ON "PaperChunk"("paperId", "chunkIndex");
CREATE INDEX "PaperChunk_paperId_chunkVersion_idx" ON "PaperChunk"("paperId", "chunkVersion");
CREATE INDEX "PaperChunk_paperId_contentHash_idx" ON "PaperChunk"("paperId", "contentHash");
CREATE INDEX "PaperChunk_embedding_ivfflat_idx" ON "PaperChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX "PaperReference_paperId_position_idx" ON "PaperReference"("paperId", "position");
CREATE INDEX "ChatMessage_chatSessionId_createdAt_idx" ON "ChatMessage"("chatSessionId", "createdAt");
CREATE INDEX "ChatCitation_chatMessageId_idx" ON "ChatCitation"("chatMessageId");
CREATE INDEX "ChatCitedClaim_chatMessageId_position_idx" ON "ChatCitedClaim"("chatMessageId", "position");
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");
CREATE INDEX "Job_lockedAt_idx" ON "Job"("lockedAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperAuthor" ADD CONSTRAINT "PaperAuthor_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperPage" ADD CONSTRAINT "PaperPage_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperSection" ADD CONSTRAINT "PaperSection_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperChunk" ADD CONSTRAINT "PaperChunk_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperChunk" ADD CONSTRAINT "PaperChunk_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PaperSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaperReference" ADD CONSTRAINT "PaperReference_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSessionPaper" ADD CONSTRAINT "ChatSessionPaper_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSessionPaper" ADD CONSTRAINT "ChatSessionPaper_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatCitation" ADD CONSTRAINT "ChatCitation_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatCitation" ADD CONSTRAINT "ChatCitation_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatCitation" ADD CONSTRAINT "ChatCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "PaperChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatCitedClaim" ADD CONSTRAINT "ChatCitedClaim_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNoteCitation" ADD CONSTRAINT "ResearchNoteCitation_researchNoteId_fkey" FOREIGN KEY ("researchNoteId") REFERENCES "ResearchNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNoteCitation" ADD CONSTRAINT "ResearchNoteCitation_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNoteCitation" ADD CONSTRAINT "ResearchNoteCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "PaperChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE SET NULL ON UPDATE CASCADE;
