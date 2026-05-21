import { getPrismaClient, type PrismaClient } from "@papertrail/db";

import { SettingsRequiredError, ValidationError } from "@/server/errors/application-error";

import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSIONS,
  type EmbeddingProviderConfig
} from "../embeddings/embeddingProvider";
import {
  DEFAULT_CHAT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_PROVIDER,
  type ChatProviderConfig
} from "../chat/chatProvider";

export const settingKeys = {
  providerBaseUrl: "providerBaseUrl",
  providerApiKey: "providerApiKey",
  chatModel: "chatModel",
  embeddingModel: "embeddingModel",
  maxRetrievedChunks: "maxRetrievedChunks",
  temperature: "temperature"
} as const;

export type RequiredProviderSettingKey =
  | "providerBaseUrl"
  | "providerApiKey"
  | "chatModel"
  | "embeddingModel";

export type PublicProviderSettings = {
  providerBaseUrl: string;
  hasApiKey: boolean;
  chatModel: string;
  embeddingModel: string;
  isComplete: boolean;
  missing: RequiredProviderSettingKey[];
};

export type LocalProviderSettings = {
  providerBaseUrl: string;
  providerApiKey: string;
  chatModel: string;
  embeddingModel: string;
  maxRetrievedChunks?: number;
  temperature?: number;
};

export type SaveProviderSettingsInput = {
  providerBaseUrl?: string;
  providerApiKey?: string;
  chatModel?: string;
  embeddingModel?: string;
  maxRetrievedChunks?: string | number | null;
  temperature?: string | number | null;
};

export type SettingsRepository = {
  getSettings(): Promise<Record<string, string>>;
  setSettings(values: Record<string, string>): Promise<void>;
};

export function createSettingsService(repository: SettingsRepository = createPrismaSettingsRepository()) {
  return {
    async getPublicSettings(): Promise<PublicProviderSettings> {
      return toPublicSettings(await repository.getSettings());
    },

    async saveProviderSettings(input: SaveProviderSettingsInput): Promise<PublicProviderSettings> {
      const current = await repository.getSettings();
      const next: Record<string, string> = {};

      if (input.providerBaseUrl !== undefined) {
        next[settingKeys.providerBaseUrl] = normalizeRequiredString(input.providerBaseUrl, "API Base URL");
      }

      if (input.providerApiKey !== undefined && input.providerApiKey.trim()) {
        next[settingKeys.providerApiKey] = input.providerApiKey.trim();
      }

      if (input.chatModel !== undefined) {
        next[settingKeys.chatModel] = normalizeRequiredString(input.chatModel, "Chat model");
      }

      if (input.embeddingModel !== undefined) {
        next[settingKeys.embeddingModel] = normalizeRequiredString(input.embeddingModel, "Embedding model");
      }

      const maxRetrievedChunks = parseOptionalPositiveInteger(input.maxRetrievedChunks, "Max retrieved chunks");
      if (maxRetrievedChunks !== undefined) {
        next[settingKeys.maxRetrievedChunks] = String(maxRetrievedChunks);
      }

      const temperature = parseOptionalNumber(input.temperature, "Temperature");
      if (temperature !== undefined) {
        next[settingKeys.temperature] = String(temperature);
      }

      const merged = { ...current, ...next };
      validateProviderSettingsForSave(merged);

      await repository.setSettings(next);

      return toPublicSettings(merged);
    },

    async requireProviderSettings(): Promise<LocalProviderSettings> {
      const settings = await repository.getSettings();
      const publicSettings = toPublicSettings(settings);

      if (!publicSettings.isComplete) {
        throw new SettingsRequiredError("Provider settings are required before running PaperTrail locally.", {
          missing: publicSettings.missing
        });
      }

      return {
        providerBaseUrl: publicSettings.providerBaseUrl,
        providerApiKey: settings[settingKeys.providerApiKey] ?? "",
        chatModel: publicSettings.chatModel,
        embeddingModel: publicSettings.embeddingModel,
        maxRetrievedChunks: parseStoredPositiveInteger(settings[settingKeys.maxRetrievedChunks]),
        temperature: parseStoredNumber(settings[settingKeys.temperature])
      };
    }
  };
}

export function createPrismaSettingsRepository(prisma: PrismaClient = getPrismaClient()): SettingsRepository {
  return {
    async getSettings() {
      const rows = await prisma.setting.findMany();

      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },

    async setSettings(values) {
      await prisma.$transaction(
        Object.entries(values).map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
          })
        )
      );
    }
  };
}

export function createChatProviderConfigFromSettings(settings: LocalProviderSettings): ChatProviderConfig {
  return {
    provider: DEFAULT_CHAT_PROVIDER,
    baseUrl: settings.providerBaseUrl,
    credential: settings.providerApiKey,
    model: settings.chatModel
  };
}

export function createEmbeddingProviderConfigFromSettings(settings: LocalProviderSettings): EmbeddingProviderConfig {
  return {
    provider: DEFAULT_EMBEDDING_PROVIDER,
    baseUrl: settings.providerBaseUrl,
    credential: settings.providerApiKey,
    model: settings.embeddingModel,
    dimensions: EMBEDDING_DIMENSIONS
  };
}

function toPublicSettings(settings: Record<string, string>): PublicProviderSettings {
  const providerBaseUrl = settings[settingKeys.providerBaseUrl]?.trim() ?? DEFAULT_CHAT_BASE_URL;
  const chatModel = settings[settingKeys.chatModel]?.trim() ?? DEFAULT_CHAT_MODEL;
  const embeddingModel = settings[settingKeys.embeddingModel]?.trim() ?? DEFAULT_EMBEDDING_MODEL;
  const hasApiKey = Boolean(settings[settingKeys.providerApiKey]?.trim());
  const missing: RequiredProviderSettingKey[] = [];

  if (!providerBaseUrl) {
    missing.push("providerBaseUrl");
  }

  if (!hasApiKey) {
    missing.push("providerApiKey");
  }

  if (!chatModel) {
    missing.push("chatModel");
  }

  if (!embeddingModel) {
    missing.push("embeddingModel");
  }

  return {
    providerBaseUrl,
    hasApiKey,
    chatModel,
    embeddingModel,
    isComplete: missing.length === 0,
    missing
  };
}

function validateProviderSettingsForSave(settings: Record<string, string>): void {
  const publicSettings = toPublicSettings(settings);

  if (publicSettings.missing.length > 0) {
    throw new ValidationError(
      Object.fromEntries(publicSettings.missing.map((key) => [key, "This setting is required."]))
    );
  }

  try {
    new URL(publicSettings.providerBaseUrl);
  } catch {
    throw new ValidationError({ providerBaseUrl: "Enter a valid API base URL." });
  }
}

function normalizeRequiredString(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new ValidationError({ [label]: `${label} is required.` });
  }

  return normalized;
}

function parseOptionalPositiveInteger(value: string | number | null | undefined, label: string): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError({ [label]: `${label} must be a positive integer.` });
  }

  return parsed;
}

function parseOptionalNumber(value: string | number | null | undefined, label: string): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError({ [label]: `${label} must be a number.` });
  }

  return parsed;
}

function parseStoredPositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseStoredNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}
