"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError } from "@/lib/api";
import { listPapers } from "@/lib/paperApi";
import type { Paper } from "@/lib/types";

import { EmptyPapersState, ErrorState, LoadingState } from "./StateViews";
import { PaperListItem } from "./PaperListItem";

export function PaperListPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    listPapers()
      .then((response) => {
        if (!ignore) {
          setPapers(response.papers);
          setError(null);
        }
      })
      .catch((listError) => {
        if (!ignore) {
          setError(listError instanceof ApiClientError ? listError.message : "Unable to load papers.");
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
  }, []);

  if (isLoading) {
    return <LoadingState label="Loading papers..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return <PaperListContent papers={papers} />;
}

export function PaperListContent({ papers }: { papers: Paper[] }) {
  if (papers.length === 0) {
    return <EmptyPapersState />;
  }

  return (
    <section className="stack" aria-labelledby="papers-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Library</p>
          <h1 id="papers-title">Documents</h1>
        </div>
        <Link className="button button--primary" href="/papers/new">
          Import PDF
        </Link>
      </div>
      <div className="paper-list">
        {papers.map((paper) => (
          <PaperListItem key={paper.id} paper={paper} />
        ))}
      </div>
    </section>
  );
}
