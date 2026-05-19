import { describe, expect, it } from "vitest";

import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("calculates a stable SHA-256 hex digest", () => {
    expect(sha256Hex(new TextEncoder().encode("papertrail"))).toBe(
      "4c7f0c661b2adf84bdd7bb540d43044628a35a3c90f06bd7b8c54007d23e7738"
    );
  });
});
