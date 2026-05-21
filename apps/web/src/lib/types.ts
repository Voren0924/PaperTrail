export type ApiErrorShape = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiErrorShape["error"] };

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

export type PaperStatus =
  | "UPLOADED"
  | "QUEUED"
  | "PARSING"
  | "EMBEDDING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "UNSUPPORTED";

export type Paper = {
  id: string;
  title: string | null;
  abstract: string | null;
  originalFileName: string;
  fileSha256: string;
  mimeType: string;
  pageCount: number | null;
  status: PaperStatus;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Job = {
  id: string;
  paperId: string | null;
  type: string;
  status: string;
};

export type ProviderSettings = {
  providerBaseUrl: string;
  hasApiKey: boolean;
  chatModel: string;
  embeddingModel: string;
  isComplete: boolean;
  missing: string[];
};

export type ChatCitation = {
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

export type ChatResponse = {
  answer: string;
  insufficientEvidence: boolean;
  citations: ChatCitation[];
  chatSessionId: string;
  assistantMessageId: string;
};
