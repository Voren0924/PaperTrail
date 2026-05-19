import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatProviderConfig } from "./chatProvider";
import { createOpenAiCompatibleChatProvider } from "./openAiCompatibleChatProvider";

describe("OpenAI-compatible chat provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts chat completion requests with JSON response format", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "response-1",
          model: "chat-model",
          choices: [{ message: { content: "{\"answer\":\"ok\"}" } }]
        }),
        { status: 200 }
      )
    );
    const provider = createOpenAiCompatibleChatProvider(createConfig());

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "Question" }],
        responseFormat: "json"
      })
    ).resolves.toEqual({
      content: "{\"answer\":\"ok\"}",
      model: "chat-model",
      providerRequestId: "response-1"
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toEqual(new URL("https://example.test/v1/chat/completions"));
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key"
    });
    const body = init?.body;

    if (typeof body !== "string") {
      throw new Error("Expected request body to be a string.");
    }

    expect(JSON.parse(body)).toMatchObject({
      model: "chat-model",
      response_format: { type: "json_object" }
    });
  });

  it("surfaces provider failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "model unavailable" } }), { status: 400 })
    );
    const provider = createOpenAiCompatibleChatProvider(createConfig());

    await expect(provider.complete({ messages: [{ role: "user", content: "Question" }] })).rejects.toThrow(
      "model unavailable"
    );
  });
});

function createConfig(): ChatProviderConfig {
  return {
    provider: "openai-compatible",
    baseUrl: "https://example.test/v1",
    credential: "test-key",
    model: "chat-model"
  };
}
