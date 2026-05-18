import { describe, expect, it } from "vitest";

import { createSessionToken, hashSessionToken } from "./session-ids";

describe("session tokens", () => {
  it("creates random browser tokens and stable database hashes", () => {
    const token = createSessionToken();
    const otherToken = createSessionToken();

    expect(token).not.toEqual(otherToken);
    expect(hashSessionToken(token)).toHaveLength(64);
    expect(hashSessionToken(token)).toEqual(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toEqual(token);
  });
});
