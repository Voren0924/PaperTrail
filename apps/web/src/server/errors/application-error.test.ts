import { describe, expect, it } from "vitest";

import { ConflictError, toApiErrorResponse, toInternalErrorResponse, ValidationError } from "./application-error";

describe("application errors", () => {
  it("maps typed errors to the shared API error shape", () => {
    expect(toApiErrorResponse(new ConflictError("Email already exists.", { email: "a@example.com" }))).toEqual({
      error: {
        code: "CONFLICT",
        message: "Email already exists.",
        details: { email: "a@example.com" }
      }
    });
  });

  it("keeps validation details under fields", () => {
    expect(toApiErrorResponse(new ValidationError({ email: "Email is required." }))).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: {
          fields: {
            email: "Email is required."
          }
        }
      }
    });
  });

  it("uses a sanitized internal error response", () => {
    expect(toInternalErrorResponse()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        details: {}
      }
    });
  });
});
