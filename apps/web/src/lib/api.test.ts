import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiRequest, toApiResult } from "./api";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws shared API errors with code, message, status, and details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed.",
              details: { fields: { providerApiKey: "API key is required." } }
            }
          }),
          { status: 422 }
        )
      )
    );

    await expect(apiRequest("/api/settings")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      status: 422,
      details: { fields: { providerApiKey: "API key is required." } }
    });
  });

  it("wraps API errors into ApiResult", async () => {
    const result = await toApiResult(
      Promise.reject(
        new ApiClientError({
          code: "SETTINGS_REQUIRED",
          message: "Provider settings are required before using this feature.",
          status: 409,
          details: {}
        })
      )
    );

    expect(result).toEqual({
      data: null,
      error: {
        code: "SETTINGS_REQUIRED",
        message: "Provider settings are required before using this feature.",
        details: {}
      }
    });
  });
});
