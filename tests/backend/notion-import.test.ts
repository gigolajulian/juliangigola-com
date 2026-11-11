import { describe, expect, it } from "vitest";
import { sealer } from "@/lib/leads/lead-crypto";
import { readLead, recordLead } from "@/lib/leads/lead-store";
import { readLog } from "@/lib/leads/activity-log";
import { importNotion } from "@/lib/leads/notion-import";
import { FakeKV, LEADS_KEY } from "./fakes";

/* Past Notion rows (`lib/leads/notion-import.ts`): quiet, fill only what is empty, once. */

const row = (ref: string, at = "2026-04-23") => ({ ref, at, note: `Notion booking: ${ref}` });

describe("importNotion", () => {
  it("makes new people quiet, fills only empty fields on existing ones, counts a dry run without writing, and adds nothing the second time", async () => {
    const kv = new FakeKV();
    const s = (await sealer(LEADS_KEY))!;
    await recordLead({ INBOX: kv as never, LEADS_KEY }, "old@example.com", { event: { at: "2026-10-01T10:00:00Z", kind: "inquiry", ref: "msg:o" }, name: "Olga" });
    const people = [
      { email: "new@example.com", name: "Nia", stage: "Delivered", quote: 350, rows: [row("b1")] },
      { email: "old@example.com", name: "Not Olga", phone: "555 0100", notes: "From Notion", rows: [row("b2", "2025-01-02")] },
      { email: "", rows: [row("b3")] },
    ];

    const dry = await importNotion(kv as never, s, people, true);
    expect(dry).toMatchObject({ created: 1, filled: 1, skipped: 1, lines: 2 });
    expect(await readLead(kv as never, s, await s.id("new@example.com"))).toBeNull();

    expect(await importNotion(kv as never, s, people, false)).toMatchObject({ created: 1, filled: 1, lines: 2 });
    const nia = (await readLead(kv as never, s, await s.id("new@example.com")))!;
    expect(nia).toMatchObject({ name: "Nia", stage: "Delivered", quote: 350, unread: false, firstAt: "2026-04-23T00:00:00.000Z" });
    const olga = (await readLead(kv as never, s, await s.id("old@example.com")))!;
    expect(olga).toMatchObject({ name: "Olga", phone: "555 0100", notes: "From Notion", stage: "Inquiry", firstAt: "2025-01-02T00:00:00.000Z" });
    expect((await readLog(kv as never, s, await s.id("old@example.com"))).map((e) => e.kind)).toEqual(["inquiry", "added"]);

    expect(await importNotion(kv as never, s, people, false)).toMatchObject({ created: 0, filled: 0, unchanged: 2, lines: 0 });
  });

  it("leaves a person he deleted for good alone", async () => {
    const kv = new FakeKV();
    const s = (await sealer(LEADS_KEY))!;
    await kv.put(`gone:${await s.id("gone@example.com")}`, "1");
    expect(await importNotion(kv as never, s, [{ email: "gone@example.com", rows: [row("b9")] }], false)).toMatchObject({ gone: 1, created: 0 });
  });
});
