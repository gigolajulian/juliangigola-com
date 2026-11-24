import { describe, expect, it } from "vitest";
import { sealer } from "@/lib/leads/lead-crypto";

describe("sealer", () => {
  it("seals and opens a photo-sized payload without overflowing the stack", async () => {
    const s = (await sealer(btoa("k".repeat(32))))!;
    const big = "x".repeat(600_000);
    expect(await s.open<string>(await s.seal(big))).toBe(big);
  });
});
