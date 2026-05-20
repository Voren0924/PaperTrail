import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-grid">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">PaperTrail</p>
        <h1 className="title" id="home-title">
          Upload papers. Ask grounded questions. Inspect the evidence.
        </h1>
        <p className="lede">
          PaperTrail turns uploaded CS PDFs into page-aware, citation-backed answers that stay tied to the source chunks
          returned by the backend.
        </p>
        <div className="actions">
          <Link className="button button--primary" href="/papers">
            Open library
          </Link>
          <Link className="button button--secondary" href="/papers/new">
            Upload PDF
          </Link>
        </div>
      </section>
      <section className="workflow-panel" aria-label="Workflow">
        <div>
          <strong>1</strong>
          <span>Upload a born-digital PDF.</span>
        </div>
        <div>
          <strong>2</strong>
          <span>Track processing and parser status.</span>
        </div>
        <div>
          <strong>3</strong>
          <span>Ask questions only when citations are ready.</span>
        </div>
      </section>
    </div>
  );
}
