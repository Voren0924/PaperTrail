import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-grid">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">PaperTrail</p>
        <h1 className="title" id="home-title">
          Import PDFs. Ask grounded questions. Inspect the evidence.
        </h1>
        <p className="lede">
          PaperTrail runs locally, stores your PDF library and indexes on this computer, and uses your configured
          OpenAI-compatible provider for citation-backed answers.
        </p>
        <div className="actions">
          <Link className="button button--primary" href="/papers">
            Open documents
          </Link>
          <Link className="button button--secondary" href="/papers/new">
            Import PDF
          </Link>
          <Link className="button button--secondary" href="/settings">
            Settings
          </Link>
        </div>
      </section>
      <section className="workflow-panel" aria-label="Workflow">
        <div>
          <strong>1</strong>
          <span>Configure your local model provider.</span>
        </div>
        <div>
          <strong>2</strong>
          <span>Import a born-digital PDF.</span>
        </div>
        <div>
          <strong>3</strong>
          <span>Ask questions once local citations are ready.</span>
        </div>
      </section>
    </div>
  );
}
