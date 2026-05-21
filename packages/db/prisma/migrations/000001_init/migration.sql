PRAGMA foreign_keys=ON;

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Paper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "title" TEXT,
    "abstract" TEXT,
    "publicationYear" INTEGER,
    "venue" TEXT,
    "doi" TEXT,
    "sourceUrl" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "pageCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "statusMessage" TEXT,
    "metadataConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Paper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaperAuthor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PaperAuthor_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaperPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperPage_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaperSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "startPage" INTEGER,
    "endPage" INTEGER,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PaperSection_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaperChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "sectionId" TEXT,
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
    "embeddingModel" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperChunk_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaperChunk_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PaperSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chunkId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vectorJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Embedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "PaperChunk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaperReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "title" TEXT,
    "authorsText" TEXT,
    "year" INTEGER,
    "venue" TEXT,
    "doi" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PaperReference_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "title" TEXT,
    "scopeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatSessionPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatSessionId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    CONSTRAINT "ChatSessionPaper_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatSessionPaper_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "temperature" REAL,
    "retrievalMetadata" JSONB,
    "providerRequestId" TEXT,
    "llmTraceId" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatCitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatMessageId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "quote" TEXT,
    "label" TEXT NOT NULL,
    CONSTRAINT "ChatCitation_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatCitation_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "PaperChunk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatCitedClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatMessageId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "citationIds" JSONB NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "ChatCitedClaim_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ResearchNoteCitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchNoteId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "chunkId" TEXT,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "quote" TEXT,
    CONSTRAINT "ResearchNoteCitation_researchNoteId_fkey" FOREIGN KEY ("researchNoteId") REFERENCES "ResearchNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchNoteCitation_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchNoteCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "PaperChunk" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "paperId" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "runAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Job_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_sessionTokenHash_key" ON "Session"("sessionTokenHash");
CREATE UNIQUE INDEX "PaperPage_paperId_pageNumber_key" ON "PaperPage"("paperId", "pageNumber");
CREATE UNIQUE INDEX "Embedding_chunkId_provider_model_key" ON "Embedding"("chunkId", "provider", "model");
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
CREATE INDEX "Embedding_provider_model_idx" ON "Embedding"("provider", "model");
CREATE INDEX "PaperReference_paperId_position_idx" ON "PaperReference"("paperId", "position");
CREATE INDEX "ChatMessage_chatSessionId_createdAt_idx" ON "ChatMessage"("chatSessionId", "createdAt");
CREATE INDEX "ChatCitation_chatMessageId_idx" ON "ChatCitation"("chatMessageId");
CREATE INDEX "ChatCitedClaim_chatMessageId_position_idx" ON "ChatCitedClaim"("chatMessageId", "position");
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");
CREATE INDEX "Job_lockedAt_idx" ON "Job"("lockedAt");
