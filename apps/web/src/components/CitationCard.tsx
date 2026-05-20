import type { ChatCitation, Paper } from "@/lib/types";

type CitationCardProps = {
  citation: ChatCitation;
  paper?: Pick<Paper, "title" | "originalFileName"> | null;
  onSelect?: (chunkId: string) => void;
};

export function CitationCard({ citation, paper, onSelect }: CitationCardProps) {
  const title = paper?.title ?? paper?.originalFileName ?? citation.paperId;
  const pages =
    citation.pageStart === citation.pageEnd
      ? `Page ${citation.pageStart}`
      : `Pages ${citation.pageStart}-${citation.pageEnd}`;

  return (
    <article className="citation-card" id={`chunk-${citation.chunkId}`}>
      <button
        className="citation-card__button"
        type="button"
        onClick={() => onSelect?.(citation.chunkId)}
        disabled={!onSelect}
      >
        <span>{citation.label}</span>
        <span>{pages}</span>
      </button>
      <h3>{title}</h3>
      {citation.sectionTitle ? <p className="muted">{citation.sectionTitle}</p> : null}
      <blockquote>{citation.quote}</blockquote>
      <code>{citation.chunkId}</code>
    </article>
  );
}
