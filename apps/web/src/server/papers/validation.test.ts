import { describe, expect, it } from "vitest";

import { UploadTooLargeError, ValidationError } from "@/server/errors/application-error";

import { validateUploadedPdf } from "./validation";

const uploadConfig = {
  maxUploadBytes: 8,
  maxUploadMb: 1
};

describe("paper upload validation", () => {
  it("accepts non-empty PDF files", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "paper.pdf", { type: "application/pdf" });

    expect(validateUploadedPdf(file, uploadConfig)).toBe(file);
  });

  it("rejects missing files", () => {
    expect(() => validateUploadedPdf(null, uploadConfig)).toThrow(ValidationError);
  });

  it("rejects non-PDF extensions", () => {
    const file = new File([new Uint8Array([1])], "paper.txt", { type: "application/pdf" });

    expect(() => validateUploadedPdf(file, uploadConfig)).toThrow(ValidationError);
  });

  it("rejects non-PDF MIME types", () => {
    const file = new File([new Uint8Array([1])], "paper.pdf", { type: "text/plain" });

    expect(() => validateUploadedPdf(file, uploadConfig)).toThrow(ValidationError);
  });

  it("rejects empty files", () => {
    const file = new File([], "paper.pdf", { type: "application/pdf" });

    expect(() => validateUploadedPdf(file, uploadConfig)).toThrow(ValidationError);
  });

  it("rejects files above the configured size limit", () => {
    const file = new File([new Uint8Array(9)], "paper.pdf", { type: "application/pdf" });

    expect(() => validateUploadedPdf(file, uploadConfig)).toThrow(UploadTooLargeError);
  });
});
