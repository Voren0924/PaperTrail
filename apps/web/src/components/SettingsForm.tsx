"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { ApiClientError } from "@/lib/api";
import { getProviderSettings, saveProviderSettings, testProviderSettings } from "@/lib/settingsApi";
import type { ProviderSettings } from "@/lib/types";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { FormField } from "./FormField";
import { LoadingState } from "./StateViews";

export function SettingsForm() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [providerBaseUrl, setProviderBaseUrl] = useState("https://api.openai.com/v1");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [chatModel, setChatModel] = useState("gpt-4o-mini");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-small");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let ignore = false;

    getProviderSettings()
      .then((response) => {
        if (ignore) {
          return;
        }

        setSettings(response.settings);
        setProviderBaseUrl(response.settings.providerBaseUrl);
        setChatModel(response.settings.chatModel);
        setEmbeddingModel(response.settings.embeddingModel);
      })
      .catch((settingsError) => {
        if (!ignore) {
          setError(settingsError instanceof ApiClientError ? settingsError.message : "Unable to load settings.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await saveProviderSettings({
        providerBaseUrl,
        providerApiKey,
        chatModel,
        embeddingModel
      });
      setSettings(response.settings);
      setProviderApiKey("");
      setStatus("Settings saved locally.");
    } catch (saveError) {
      setError(saveError instanceof ApiClientError ? saveError.message : "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setError(null);
    setStatus(null);

    try {
      await testProviderSettings();
      setStatus("Provider connection succeeded.");
    } catch (testError) {
      setError(testError instanceof ApiClientError ? testError.message : "Provider connection failed.");
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading local settings..." />;
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local settings</p>
          <h1 id="settings-title">Model provider</h1>
        </div>
      </div>
      {!settings?.isComplete ? (
        <Alert tone="warning">Provider settings are required before importing and asking questions.</Alert>
      ) : null}
      {status ? <Alert tone="success">{status}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="settings-form" onSubmit={(event) => void handleSave(event)}>
        <FormField
          label="API Base URL"
          value={providerBaseUrl}
          onChange={(event) => setProviderBaseUrl(event.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <FormField
          label="API Key"
          type="password"
          value={providerApiKey}
          onChange={(event) => setProviderApiKey(event.target.value)}
          placeholder={settings?.hasApiKey ? "Saved locally; enter a new key to replace" : "Enter provider API key"}
          hint="Stored locally for this MVP. OS keychain storage is planned for the desktop packaging pass."
        />
        <FormField
          label="Chat Model"
          value={chatModel}
          onChange={(event) => setChatModel(event.target.value)}
          placeholder="gpt-4o-mini"
        />
        <FormField
          label="Embedding Model"
          value={embeddingModel}
          onChange={(event) => setEmbeddingModel(event.target.value)}
          placeholder="text-embedding-3-small"
        />
        <div className="actions">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleTest()} disabled={isTesting || isSaving}>
            {isTesting ? "Testing..." : "Test connection"}
          </Button>
        </div>
      </form>
    </section>
  );
}
