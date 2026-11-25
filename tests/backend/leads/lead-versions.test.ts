import { describe, expect, it } from "vitest";
import { sealer } from "@/lib/seal";
import { everyLead, readLead, recordLead } from "@/lib/leads/lead-store";
import { clientsCsv } from "@/lib/leads/sync/sheet-sync";
import { LEAD_VERSION, leadStoreKey, type Lead } from "@/lib/leads/leads";
import { FakeKV, LEADS_KEY } from "../fakes";

/* DATA-3: leads carry a version; a record from an older build still opens; one that will not open never empties the Sheet. */

const seal = async () => (await sealer(LEADS_KEY))!;
/** A lead as the first builds stored it: no version, no unread flag. */
const OLD = {
  email: "maya@example.com",
  name: "Maya",
  stage: "New",
  stageAt: "2026-05-01T00:00:00Z",
  firstAt: "2026-05-01T00:00:00Z",
  lastAt: "2026-05-01T00:00:00Z",
  events: [{ at: "2026-05-01T00:00:00Z", kind: "inquiry", ref: "msg:1" }],
};

describe("lead versions", () => {
  it("opens a record from an older build, and the next write stamps the current version", async () => {
    const kv = new FakeKV();
    const s = await seal();
    const id = await s.id(OLD.email);
    await kv.put(leadStoreKey(id), await s.seal(OLD));
    const opened = (await readLead(kv as never, s, id))!;
    expect(opened).toMatchObject({ name: "Maya", unread: false, v: LEAD_VERSION });
    await recordLead({ INBOX: kv as never, LEADS_KEY }, OLD.email, {
      event: { at: "2026-06-01T00:00:00Z", kind: "inquiry", ref: "msg:2" },
    });
    const raw = await s.open<Lead>((await kv.get(leadStoreKey(id)))!);
    expect(raw.v).toBe(LEAD_VERSION);
    expect(raw.events).toHaveLength(2);
  });

  it("refuses a record from a newer build rather than rewrite it without what it does not know", async () => {
    const kv = new FakeKV();
    const s = await seal();
    const id = await s.id(OLD.email);
    await kv.put(leadStoreKey(id), await s.seal({ ...OLD, v: LEAD_VERSION + 1 }));
    await expect(readLead(kv as never, s, id)).rejects.toThrow(/newer than this build/);
  });

  it("leaves a lead that will not open out of the numbers, but stops the Sheet copy rather than drop its row", async () => {
    const kv = new FakeKV();
    const s = await seal();
    await recordLead({ INBOX: kv as never, LEADS_KEY }, "ana@example.com", {
      event: { at: "2026-06-01T00:00:00Z", kind: "inquiry", ref: "a" },
    });
    const bad = await s.id("sam@example.com");
    await kv.put(leadStoreKey(bad), "not a sealed lead");
    expect((await everyLead(kv as never, s)).map((l) => l.email)).toEqual(["ana@example.com"]);
    await expect(clientsCsv(kv as never, s, [], true)).rejects.toThrow(/would not open/);
  });
});
