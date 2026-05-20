import type { ChatCitation, Paper } from "@/lib/types";

import { Alert } from "./Alert";
import { CitationCard } from "./CitationCard";

type EvidencePreviewProps = {
  citations: ChatCitation[];
  selectedChunkId?: string | null;
  paper?: Pick<Paper, "title" | "originalFileName"> | null;
};

export function EvidencePreview({ citations, selectedChunkId, paper }: EvidencePreviewProps) {
  const selected = citations.find((citation) => citation.chunkId === selectedChunkId) ?? citations[0];

  if (!selected) {
    return (
      <Alert tone="info" title="Evidence preview">
        Paper chunk preview endpoints are not available yet. Citations returned by chat will appear here after a question
        is answered.
      </Alert>
    );
  }

  return (
    <section className="evidence-preview" aria-labelledby="evidence-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Evidence</p>
          <h2 id="evidence-title">Chunk preview</h2>
        </div>
      </div>
      <CitationCard citation={selected} paper={paper} />
      <pre>{selected.text}</pre>
    </section>
  );
}
