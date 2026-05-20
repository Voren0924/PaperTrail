import { describe, expect, it } from "vitest";

import { validateEmail, validatePassword, validatePdfFile } from "./validation";

describe("auth form validation", () => {
  it("validates email and password input", () => {
    expect(validateEmail("")).toBe("Email is required.");
    expect(validateEmail("papertrail")).toBe("Enter a valid email address.");
    expect(validateEmail("student@example.com")).toBeNull();
    expect(validatePassword("short")).toBe("Password must be at least 8 characters.");
    expect(validatePassword("long-enough")).toBeNull();
  });
});

describe("upload form validation", () => {
  it("requires a PDF file", () => {
    expect(validatePdfFile(null)).toBe("Choose a PDF file.");
    expect(validatePdfFile(new File(["paper"], "paper.txt", { type: "text/plain" }))).toBe(
      "Only PDF files can be uploaded."
    );
    expect(validatePdfFile(new File(["paper"], "paper.pdf", { type: "application/pdf" }))).toBeNull();
  });

  it("rejects empty and oversized files", () => {
    expect(validatePdfFile(new File([], "empty.pdf", { type: "application/pdf" }))).toBe(
      "The selected file is empty."
    );
    expect(validatePdfFile(new File(["x".repeat(11)], "large.pdf", { type: "application/pdf" }), 0.000001)).toBe(
      "PDF must be 0.000001 MB or smaller."
    );
  });
});
