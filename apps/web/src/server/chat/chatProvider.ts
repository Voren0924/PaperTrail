export const DEFAULT_CHAT_PROVIDER = "openai-compatible";
export const DEFAULT_CHAT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

export type ChatProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatProviderResponse = {
  content: string;
  model: string;
  providerRequestId: string | null;
};

export type ChatProvider = {
  name: string;
  model: string;
  complete(input: {
    messages: ChatProviderMessage[];
    responseFormat?: "json";
    temperature?: number;
  }): Promise<ChatProviderResponse>;
};

export type ChatProviderConfig = {
  provider: string;
  baseUrl: string;
  credential: string;
  model: string;
};

export class ChatProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ChatProviderError";
  }
}

export class ChatConfigurationError extends ChatProviderError {
  constructor(message: string) {
    super(message);
    this.name = "ChatConfigurationError";
  }
}

export function getChatProviderConfig(env: Record<string, string | undefined> = process.env): ChatProviderConfig {
  const provider = env.CHAT_PROVIDER ?? DEFAULT_CHAT_PROVIDER;
  const baseUrl = env.CHAT_BASE_URL ?? DEFAULT_CHAT_BASE_URL;
  const credential = env.CHAT_API_KEY ?? "";
  const model = env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL;

  if (provider !== DEFAULT_CHAT_PROVIDER) {
    throw new ChatConfigurationError(`Unsupported chat provider: ${provider}.`);
  }

  if (!credential) {
    throw new ChatConfigurationError("CHAT_API_KEY is required for grounded answering.");
  }

  return {
    provider,
    baseUrl,
    credential,
    model
  };
}
