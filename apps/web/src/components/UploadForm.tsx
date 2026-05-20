"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { ApiClientError } from "@/lib/api";
import { uploadPaper } from "@/lib/paperApi";
import { DEFAULT_MAX_UPLOAD_MB, validatePdfFile } from "@/lib/validation";

import { Alert } from "./Alert";
import { Button } from "./Button";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validatePdfFile(file);

    if (validationError || !file) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadPaper(file);
      router.push(`/papers/${result.paper.id}`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof ApiClientError ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={(event) => void handleSubmit(event)}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <label className="file-picker">
        <span>PDF file</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            setFile(nextFile);
            setError(validatePdfFile(nextFile));
          }}
        />
        <small>Maximum upload size: {DEFAULT_MAX_UPLOAD_MB} MB.</small>
      </label>
      {file ? (
        <div className="selected-file">
          <strong>{file.name}</strong>
          <span>{formatBytes(file.size)}</span>
        </div>
      ) : null}
      <Button type="submit" disabled={isUploading}>
        {isUploading ? "Uploading..." : "Upload paper"}
      </Button>
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
