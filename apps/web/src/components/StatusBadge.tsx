import type { PaperStatus } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Uploaded",
  QUEUED: "Queued",
  PARSING: "Processing",
  EMBEDDING: "Embedding",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
  UNSUPPORTED: "Unsupported"
};

const STATUS_TONES: Record<string, "neutral" | "progress" | "success" | "error" | "warning"> = {
  UPLOADED: "neutral",
  QUEUED: "progress",
  PARSING: "progress",
  EMBEDDING: "progress",
  PROCESSING: "progress",
  READY: "success",
  FAILED: "error",
  UNSUPPORTED: "warning"
};

export function StatusBadge({ status }: { status: PaperStatus }) {
  const label = STATUS_LABELS[status] ?? titleCase(status);
  const tone = STATUS_TONES[status] ?? "neutral";

  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}

export function isPaperReady(status: PaperStatus): boolean {
  return status === "READY";
}

export function canRetryPaper(status: PaperStatus): boolean {
  return status === "FAILED" || status === "UNSUPPORTED";
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
