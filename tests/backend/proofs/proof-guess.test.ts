import { describe, expect, it } from "vitest";
import { readPublic } from "@/lib/proofs/proof-store";
import { sealer } from "@/lib/seal";
import { FakeKV, LEADS_KEY } from "../fakes";

/* Old gallery ids (`MMDDYYYY-NN-xxxx`) have 4 random characters. Wrong guesses from one address count against the
   limiter, and past it that address reads no old id for an hour, even a real one. */

/** A limiter that allows `n` calls per key. */
const limiter = (n: number) => {
  const used = new Map<string, number>();
  return {
    async limit({ key }: { key: string }) {
      used.set(key, (used.get(key) ?? 0) + 1);
      return { success: used.get(key)! <= n };
    },
  };
};

describe("readPublic guard", () => {
  it("blocks an address that keeps missing old ids, and leaves others alone", async () => {
    const kv = new FakeKV();
    const s = (await sealer(LEADS_KEY))!;
    const guard = { ip: "203.0.113.9", limiter: limiter(2) };
    for (const g of ["11202026-01-aaaa", "11202026-01-aaab", "11202026-01-aaac"])
      expect(await readPublic(kv as never, s, g, guard)).toBeNull();
    // Past the limit the block is in KV for that address only, with an hour's life.
    const blocks = [...kv.data.keys()].filter((k) => k.startsWith("proofguess:"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).not.toContain("203.0.113.9");
    expect(kv.data.get(blocks[0])!.ttl).toBe(3600);
    // Blocked: the next old id is refused before the store is read, so no new block is written.
    const asked = kv.puts.length;
    expect(await readPublic(kv as never, s, "11202026-01-zzzz", guard)).toBeNull();
    expect(kv.puts.length).toBe(asked);
    // A strong id from the same address is not checked against the block, and no guard means no block (admin reads).
    expect(await readPublic(kv as never, s, "ABCDEFGHIJKLMNOP", guard)).toBeNull();
    expect([...kv.data.keys()].filter((k) => k.startsWith("proofguess:"))).toHaveLength(1);
    // Another address still guesses freely.
    await readPublic(kv as never, s, "11202026-01-aaad", { ip: "198.51.100.1", limiter: limiter(2) });
    expect([...kv.data.keys()].filter((k) => k.startsWith("proofguess:"))).toHaveLength(1);
  });
});
