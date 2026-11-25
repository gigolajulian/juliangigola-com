import { describe, expect, it } from "vitest";
import { recordLead } from "@/lib/leads/lead-store";
import { sealer } from "@/lib/seal";
import { FakeKV, LEADS_KEY } from "../fakes";

/* KV refuses a second write to one key within a second (a 429 from the binding). Back-to-back lines on one lead
   (a deposit's payment and its refund, a mail log and then the money) must still all land. */

/** FakeKV with KV's one-write-a-second rule on `lead:` keys. */
class StrictKV extends FakeKV {
  last = new Map<string, number>();
  async put(key: string, value: string | ArrayBuffer, opts: { metadata?: unknown; expirationTtl?: number } = {}) {
    const now = Date.now();
    if (key.startsWith("lead:") && now - (this.last.get(key) ?? -Infinity) < 1000) throw new Error("KV PUT failed: 429 Too Many Requests");
    if (key.startsWith("lead:")) this.last.set(key, now);
    return super.put(key, value, opts);
  }
}

describe("recordLead", () => {
  it("writes two changes in one go, and retries a write KV refused", async () => {
    const kv = new StrictKV();
    const env = { INBOX: kv as never, LEADS_KEY };
    const at = "2026-11-20T10:00:00Z";
    expect((await recordLead(env, "a@example.com", { event: { at, kind: "inquiry", ref: "msg:1" }, name: "A" })).status).toBe("written");
    // The next write lands within the second: refused once, then written after the wait.
    const both = await recordLead(env, "a@example.com", [
      { event: { at, kind: "payment", ref: "pi_1", note: "Deposit", amount: 100 } },
      { event: { at, kind: "refund", ref: "refund-pi_1", note: "Deposit, the time was gone", amount: 100 } },
    ]);
    expect(both.status).toBe("written");
    const [[key, entry]] = [...kv.data.entries()].filter(([k]) => k.startsWith("lead:"));
    const lead = await (await sealer(LEADS_KEY))!.open<{ events: { kind: string }[] }>(entry.value as string);
    expect(key).toMatch(/^lead:/);
    expect(lead.events.map((e) => e.kind)).toEqual(["inquiry", "payment", "refund"]);
  });
});
