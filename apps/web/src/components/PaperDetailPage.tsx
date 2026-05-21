"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError } from "@/lib/api";
import { getPaper, retryPaper } from "@/lib/paperApi";
import type { ChatCitation, Paper } from "@/lib/types";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { ChatPanel } from "./ChatPanel";
import { EvidencePreview } from "./EvidencePreview";
import { ErrorState, LoadingState } from "./StateViews";
import { canRetryPaper, isPaperReady, StatusBadge } from "./StatusBadge";

export function PaperDetailPage({ paperId }: { paperId: string }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [citations, setCitations] = useState<ChatCitation[]>([]);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let ignore = false;

    getPaper(paperId)
      .then((response) => {
        if (!ignore) {
          setPaper(response.paper);
          setError(null);
        }
      })
      .catch((detailError) => {
        if (!ignore) {
          setError(detailError instanceof ApiClientError ? detailError.message : "Unable to load this paper.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [paperId]);

  async function handleRetry() {
    if (!paper) {
      return;
    }

    setIsRetrying(true);
    setRetryError(null);

    try {
      const response = await retryPaper(paper.id);
      setPaper(response.paper);
    } catch (retryFailure) {
      setRetryError(retryFailure instanceof ApiClientError ? retryFailure.message : "Retry request failed.");
    } finally {
      setIsRetrying(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading paper..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!paper) {
    return <ErrorState message="Paper not found." />;
  }

  return (
    <div className="paper-detail">
      <section className="paper-meta" aria-labelledby="paper-title">
        <Link className="back-link" href="/papers">
          Back to documents
        </Link>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Document detail</p>
            <h1 id="paper-title">{paper.title ?? paper.originalFileName}</h1>
          </div>
          <StatusBadge status={paper.status} />
        </div>
        <dl className="meta-grid">
          <div>
            <dt>Original file</dt>
            <dd>{paper.originalFileName}</dd>
          </div>
          <div>
            <dt>Pages</dt>
            <dd>{paper.pageCount ?? "Pending"}</dd>
          </div>
          <div>
            <dt>Uploaded</dt>
            <dd>{new Date(paper.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(paper.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
        {paper.abstract ? (
          <div className="abstract">
            <h2>Abstract</h2>
            <p>{paper.abstract}</p>
          </div>
        ) : (
          <Alert tone="info">No abstract has been extracted for this paper yet.</Alert>
        )}
        <ProcessingStatus paper={paper} />
        {retryError ? <Alert tone="error">{retryError}</Alert> : null}
        {canRetryPaper(paper.status) ? (
          <Button variant="secondary" onClick={() => void handleRetry()} disabled={isRetrying}>
            {isRetrying ? "Retrying..." : "Retry processing"}
          </Button>
        ) : null}
      </section>
      <section className="detail-grid">
        <div className="stack">
          <EvidencePreview citations={citations} selectedChunkId={selectedChunkId} paper={paper} />
        </div>
        <ChatPanel
          paper={paper}
          disabledReason={
            isPaperReady(paper.status)
              ? null
              : "Chat becomes available after parsing, chunking, and embeddings finish."
          }
          onCitations={(nextCitations) => {
            setCitations(nextCitations);
            setSelectedChunkId(nextCitations[0]?.chunkId ?? null);
          }}
          onSelectCitation={setSelectedChunkId}
        />
      </section>
    </div>
  );
}

function ProcessingStatus({ paper }: { paper: Paper }) {
  if (paper.status === "READY") {
    return <Alert tone="success">This paper is ready for citation-grounded chat.</Alert>;
  }

  if (paper.status === "FAILED") {
    return (
      <Alert tone="error" title="Processing failed">
        {paper.statusMessage ?? "The parser could not finish processing this paper."}
      </Alert>
    );
  }

  if (paper.status === "UNSUPPORTED") {
    return (
      <Alert tone="warning" title="Unsupported PDF">
        {paper.statusMessage ?? "This PDF cannot be processed with the current parser."}
      </Alert>
    );
  }

  return (
    <Alert tone="info" title="Processing in progress">
      {paper.statusMessage ?? "The worker is preparing pages, chunks, embeddings, and retrieval evidence."}
    </Alert>
  );
}
