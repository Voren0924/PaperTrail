import { apiRequest } from "./api";
import type { ProviderSettings } from "./types";

export type SettingsResponse = {
  settings: ProviderSettings;
};

export type SaveSettingsInput = {
  providerBaseUrl: string;
  providerApiKey?: string;
  chatModel: string;
  embeddingModel: string;
};

export function getProviderSettings(): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/settings");
}

export function saveProviderSettings(input: SaveSettingsInput): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function testProviderSettings(): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>("/api/settings/test", {
    method: "POST"
  });
}
