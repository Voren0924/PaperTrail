import { describe, expect, it } from "vitest";

import { ValidationError } from "@/server/errors/application-error";

import { validateAuthCredentials } from "./request";

describe("request validation", () => {
  it("normalizes valid auth credentials", () => {
    expect(validateAuthCredentials({ email: " USER@example.COM ", password: "password123" })).toEqual({
      email: "user@example.com",
      password: "password123"
    });
  });

  it("returns field-level auth validation details", () => {
    expect(() => validateAuthCredentials({ email: "nope", password: "short" })).toThrow(ValidationError);

    try {
      validateAuthCredentials({ email: "nope", password: "short" });
    } catch (error) {
      expect(error).toMatchObject({
        code: "VALIDATION_ERROR",
        details: {
          fields: {
            email: "Email must be valid.",
            "password": "Password must be at least 8 characters."
          }
        }
      });
    }
  });
});
