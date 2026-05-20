import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "./Alert";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="state-view" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <Alert tone="error" title="Something went wrong">
      <p>{message}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </Alert>
  );
}

export function EmptyPapersState() {
  return (
    <div className="empty-state">
      <h2>No papers yet</h2>
      <p>Upload a PDF to start extracting metadata, chunks, citations, and grounded answers.</p>
      <Link className="button button--primary" href="/papers/new">
        Upload PDF
      </Link>
    </div>
  );
}
