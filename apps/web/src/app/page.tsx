import { getAppName } from "@papertrail/shared";

export default function HomePage() {
  return (
    <section className="panel" aria-labelledby="home-title">
      <p className="eyebrow">{getAppName()} foundation</p>
      <h1 className="title" id="home-title">
        Research papers, ready for grounded answers.
      </h1>
      <p className="lede">
        This app shell establishes the PaperTrail monorepo, shared packages,
        strict TypeScript, linting, formatting, and test tooling for the MVP
        workstreams that follow.
      </p>
    </section>
  );
}
