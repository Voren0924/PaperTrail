import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorState, LoadingState } from "./StateViews";

describe("state views", () => {
  it("renders loading state text", () => {
    const html = renderToStaticMarkup(<LoadingState label="Loading papers..." />);

    expect(html).toContain("Loading papers...");
    expect(html).toContain("role=\"status\"");
  });

  it("renders error state text", () => {
    const html = renderToStaticMarkup(<ErrorState message="Unable to load papers." />);

    expect(html).toContain("Something went wrong");
    expect(html).toContain("Unable to load papers.");
  });
});
