import Link from "next/link";

import type { Paper } from "@/lib/types";

import { StatusBadge } from "./StatusBadge";

export function PaperListItem({ paper }: { paper: Paper }) {
  return (
    <Link className="paper-list-item" href={`/papers/${paper.id}`}>
      <div>
        <h2>{paper.title ?? paper.originalFileName}</h2>
        <p>{paper.originalFileName}</p>
      </div>
      <dl>
        <div>
          <dt>Uploaded</dt>
          <dd>{formatDate(paper.createdAt)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={paper.status} />
          </dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{paper.pageCount ?? "Pending"}</dd>
        </div>
      </dl>
    </Link>
  );
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
