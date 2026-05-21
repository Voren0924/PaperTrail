import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppNav } from "./AppNav";

describe("AppNav", () => {
  it("renders local desktop navigation without auth actions", () => {
    const html = renderToStaticMarkup(<AppNav />);

    expect(html).toContain("Documents");
    expect(html).toContain("Import");
    expect(html).toContain("Settings");
    expect(html).not.toContain("Log in");
    expect(html).not.toContain("Register");
    expect(html).not.toContain("Log out");
  });
});
