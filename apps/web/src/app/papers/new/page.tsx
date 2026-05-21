import Link from "next/link";

import { UploadForm } from "@/components/UploadForm";

export default function NewPaperPage() {
  return (
    <section className="stack" aria-labelledby="upload-title">
      <Link className="back-link" href="/papers">
        Back to documents
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Import</p>
          <h1 id="upload-title">Add a local PDF</h1>
        </div>
      </div>
      <UploadForm />
    </section>
  );
}
