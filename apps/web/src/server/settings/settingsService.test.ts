import { describe, expect, it } from "vitest";

import { SettingsRequiredError, ValidationError } from "@/server/errors/application-error";

import {
  createChatProviderConfigFromSettings,
  createEmbeddingProviderConfigFromSettings,
  createSettingsService,
  type SettingsRepository
} from "./settingsService";

describe("settings service", () => {
  it("returns masked public settings and missing API key status", async () => {
    const service = createSettingsService(createMemoryRepository({}));

    await expect(service.getPublicSettings()).resolves.toMatchObject({
      providerBaseUrl: "https://api.openai.com/v1",
      hasApiKey: false,
      chatModel: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-small",
      isComplete: false,
      missing: ["providerApiKey"]
    });
  });

  it("saves complete local provider settings without exposing the API key", async () => {
    const repository = createMemoryRepository({});
    const service = createSettingsService(repository);

    await expect(
      service.saveProviderSettings({
        providerBaseUrl: "https://example.test/v1",
        providerApiKey: "secret-key",
        chatModel: "chat-model",
        embeddingModel: "embedding-model"
      })
    ).resolves.toEqual({
      providerBaseUrl: "https://example.test/v1",
      hasApiKey: true,
      chatModel: "chat-model",
      embeddingModel: "embedding-model",
      isComplete: true,
      missing: []
    });
    expect(repository.values.providerApiKey).toBe("secret-key");
  });

  it("keeps an existing API key when saving non-secret settings", async () => {
    const repository = createMemoryRepository({
      providerBaseUrl: "https://example.test/v1",
      providerApiKey: "existing-key",
      chatModel: "chat-model",
      embeddingModel: "embedding-model"
    });
    const service = createSettingsService(repository);

    await service.saveProviderSettings({
      providerBaseUrl: "https://example.test/v2",
      providerApiKey: "",
      chatModel: "new-chat-model",
      embeddingModel: "embedding-model"
    });

    expect(repository.values.providerApiKey).toBe("existing-key");
    expect(repository.values.providerBaseUrl).toBe("https://example.test/v2");
    expect(repository.values.chatModel).toBe("new-chat-model");
  });

  it("throws a clear error when required settings are missing", async () => {
    const service = createSettingsService(createMemoryRepository({}));

    await expect(service.requireProviderSettings()).rejects.toThrow(SettingsRequiredError);
    await expect(
      service.saveProviderSettings({
        providerBaseUrl: "not a url",
        providerApiKey: "secret",
        chatModel: "chat",
        embeddingModel: "embedding"
      })
    ).rejects.toThrow(ValidationError);
  });

  it("builds provider configs from local settings", async () => {
    const service = createSettingsService(
      createMemoryRepository({
        providerBaseUrl: "https://example.test/v1",
        providerApiKey: "secret-key",
        chatModel: "chat-model",
        embeddingModel: "embedding-model"
      })
    );
    const settings = await service.requireProviderSettings();

    expect(createChatProviderConfigFromSettings(settings)).toMatchObject({
      baseUrl: "https://example.test/v1",
      credential: "secret-key",
      model: "chat-model"
    });
    expect(createEmbeddingProviderConfigFromSettings(settings)).toMatchObject({
      baseUrl: "https://example.test/v1",
      credential: "secret-key",
      model: "embedding-model"
    });
  });
});

function createMemoryRepository(initialValues: Record<string, string>): SettingsRepository & {
  values: Record<string, string>;
} {
  const values = { ...initialValues };

  return {
    values,
    getSettings() {
      return Promise.resolve({ ...values });
    },
    setSettings(nextValues) {
      Object.assign(values, nextValues);
      return Promise.resolve();
    }
  };
}
