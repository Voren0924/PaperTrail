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
              details: { fields: { email: "Email is required." } }
            }
          }),
          { status: 422 }
        )
      )
    );

    await expect(apiRequest("/api/auth/login")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      status: 422,
      details: { fields: { email: "Email is required." } }
    });
  });

  it("wraps API errors into ApiResult", async () => {
    const result = await toApiResult(
      Promise.reject(
        new ApiClientError({
          code: "UNAUTHENTICATED",
          message: "Sign in is required.",
          status: 401,
          details: {}
        })
      )
    );

    expect(result).toEqual({
      data: null,
      error: {
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        details: {}
      }
    });
  });
});
