import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { newToken, sha256Hex } from "@/lib/token";

describe("sha256Hex", () => {
  it("matches Node's hex SHA-256 on UTF-8 text", async () => {
    for (const s of ["", "abc", "Signé · 署名 ok"]) expect(await sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
  });
});

describe("newToken", () => {
  it("gives 16 base62 characters, fresh each time", () => {
    const a = newToken();
    expect(a).toMatch(/^[0-9A-Za-z]{16}$/);
    expect(newToken()).not.toBe(a);
  });
});
