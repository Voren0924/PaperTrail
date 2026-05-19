import { describe, expect, it } from "vitest";

import {
  ChatConfigurationError,
  DEFAULT_CHAT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_PROVIDER,
  getChatProviderConfig
} from "./chatProvider";

describe("chat provider config", () => {
  it("builds OpenAI-compatible chat config from environment variables", () => {
    expect(
      getChatProviderConfig({
        CHAT_PROVIDER: "openai-compatible",
        CHAT_BASE_URL: "https://example.test/v1",
        CHAT_API_KEY: "test-key",
        CHAT_MODEL: "chat-model"
      })
    ).toEqual({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      credential: "test-key",
      model: "chat-model"
    });
  });

  it("uses safe defaults except for the required credential", () => {
    expect(
      getChatProviderConfig({
        CHAT_API_KEY: "test-key"
      })
    ).toEqual({
      provider: DEFAULT_CHAT_PROVIDER,
      baseUrl: DEFAULT_CHAT_BASE_URL,
      credential: "test-key",
      model: DEFAULT_CHAT_MODEL
    });
  });

  it("rejects unsupported chat providers", () => {
    expect(() =>
      getChatProviderConfig({
        CHAT_PROVIDER: "custom",
        CHAT_API_KEY: "test-key"
      })
    ).toThrow(ChatConfigurationError);
  });
});
