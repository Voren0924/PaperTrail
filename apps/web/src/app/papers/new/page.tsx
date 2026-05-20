import Link from "next/link";

import { AuthGate } from "@/components/AuthGate";
import { UploadForm } from "@/components/UploadForm";

export default function NewPaperPage() {
  return (
    <AuthGate>
      <section className="stack" aria-labelledby="upload-title">
        <Link className="back-link" href="/papers">
          Back to papers
        </Link>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Upload</p>
            <h1 id="upload-title">Add a paper</h1>
          </div>
        </div>
        <UploadForm />
      </section>
    </AuthGate>
  );
}
