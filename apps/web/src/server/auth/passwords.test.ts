import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./passwords";

describe("password hashing", () => {
  it("hashes and verifies passwords without storing the raw password", async () => {
    const passphrase = ["correct", "horse", "battery", "staple"].join(" ");
    const passwordHash = await hashPassword(passphrase);

    expect(passwordHash).toMatch(/^scrypt-v1\$/);
    expect(passwordHash).not.toContain(passphrase);
    await expect(verifyPassword(passphrase, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(false);
  });
});
