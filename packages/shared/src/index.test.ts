import { describe, expect, it } from "vitest";
import { getAppName } from "./index.js";

describe("getAppName", () => {
  it("returns the product name", () => {
    expect(getAppName()).toBe("PaperTrail");
  });
});
