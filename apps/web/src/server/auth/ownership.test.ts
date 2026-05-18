import { describe, expect, it } from "vitest";

import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";

import { ensureOwnedRecord } from "./ownership";

describe("ownership checks", () => {
  it("returns records that belong to the current user", () => {
    const record = { id: "paper-1", userId: "user-1" };

    expect(ensureOwnedRecord(record, "user-1")).toBe(record);
  });

  it("hides missing and cross-user records by default", () => {
    expect(() => ensureOwnedRecord(null, "user-1", { resourceName: "Paper" })).toThrow(NotFoundError);
    expect(() => ensureOwnedRecord({ userId: "user-2" }, "user-1", { resourceName: "Paper" })).toThrow(
      NotFoundError
    );
  });

  it("can surface forbidden errors when a service needs that behavior", () => {
    expect(() =>
      ensureOwnedRecord({ userId: "user-2" }, "user-1", {
        resourceName: "Paper",
        failureMode: "forbidden"
      })
    ).toThrow(ForbiddenError);
  });
});
