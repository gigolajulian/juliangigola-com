import { beforeEach, describe, expect, it, vi } from "vitest";
// Relative imports: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { patchLead } from "../../lib/leads/lead-patch";
import { sealer } from "../../lib/leads/lead-crypto";
import { readLead, writeLead } from "../../lib/leads/lead-store";
import { applyLeadEvent, type Lead } from "../../lib/leads/leads";
import { FakeKV, LEADS_KEY } from "./fakes";

/* patchLead called directly: what each field does to the stored lead, what
   it refuses, and that a refused patch writes nothing. Fake people only. */

const s = (await sealer(LEADS_KEY))!;
const EMAIL = "maya@example.com";
let kv: FakeKV;
let id: string;
let key: string;

beforeEach(async () => {
  kv = new FakeKV();
  id = await s.id(EMAIL);
  key = `lead:${id}`;
  const lead: Lead = applyLeadEvent(null, EMAIL, { event: { at: "2026-11-01T10:00:00Z", kind: "inquiry", ref: "msg:1" }, name: "Maya Ortiz" });
  await writeLead(kv as never, s, id, lead);
  kv.puts = [];
});

const patch = async (body: Record<string, unknown>) => {
  const res = await patchLead(kv as never, s, { key, ...body });
  return { status: res.status, body: (await res.json()) as { lead?: Lead; error?: string } };
};
const stored = async () => (await readLead(kv as never, s, id))!;
const BILL = { date: "2026-11-06", lines: [{ desc: "Portraits", qty: 1, rate: 450 }], paid: 100 };

describe("patchLead: refusals", () => {
  it.each([
    [{ contract: "Maybe" }, 400, "Unknown status."],
    [{ release: "Lost" }, 400, "Unknown status."],
    [{ stage: "Booked" }, 400, "Unknown stage."],
    [{ snoozeUntil: "later" }, 400, "Bad time."],
    [{ remind: { at: "never" } }, 400, "Bad time."],
    [{ quote: -1 }, 400, "Bad amount."],
    [{ quote: 1e7 }, 400, "Bad amount."],
    [{ licence: { use: "Web", end: "2027-13-40" } }, 400, "Bad date."],
    [{ invoice: { date: "2026-11-06", lines: [] } }, 400, "One to"],
    [{ invoicePaid: { no: "0999", paid: true } }, 404, "No such invoice."],
    [{ mergeFrom: "lead:nobody" }, 404, "Gone."],
  ])("%j answers %i and writes nothing", async (body, status, error) => {
    const r = await patch(body);
    expect(r.status).toBe(status);
    expect(r.body.error).toContain(error);
    expect(kv.puts).toEqual([]);
  });

  it("404s a lead that is not there", async () => {
    const res = await patchLead(kv as never, s, { key: "lead:0000", seen: true });
    expect(res.status).toBe(404);
  });
});

describe("patchLead: fields", () => {
  it("stage and snooze land on the timeline, and an empty snooze wakes it", async () => {
    expect((await patch({ stage: "Quoted", snoozeUntil: "2026-12-01T00:00:00Z" })).status).toBe(200);
    let l = await stored();
    expect(l.stage).toBe("Quoted");
    expect(l.snoozeUntil).toBe("2026-12-01T00:00:00Z");
    expect(l.events.slice(-2).map((e) => [e.kind, e.note])).toEqual([["stage", "Quoted"], ["snooze", "2026-12-01T00:00:00Z"]]);
    await patch({ snoozeUntil: "" });
    l = await stored();
    expect(l.snoozeUntil).toBeUndefined();
    expect(l.events.at(-1)).toMatchObject({ kind: "snooze", note: "woken" });
  });

  it("seen false marks it unread again; seen true opens it", async () => {
    await patch({ seen: false });
    expect((await stored()).unread).toBe(true);
    await patch({ seen: true });
    expect((await stored()).unread).toBe(false);
  });

  it("cleans the details: trimmed, @ on the handle, kind lowercased, a blank name kept", async () => {
    const { body } = await patch({ details: { name: "  ", phone: " 408 555 0100 ", ig: "maya.shoots", company: "", kind: "  Portraits " } });
    expect(body.lead).toMatchObject({ name: "Maya Ortiz", phone: "408 555 0100", ig: "@maya.shoots", kind: "portraits" });
    expect(body.lead?.company).toBeUndefined();
    expect(body.lead?.events.at(-1)?.kind).toBe("edit");
  });

  it("sets and clears a quote, logging each", async () => {
    await patch({ quote: 1200 });
    expect((await stored()).quote).toBe(1200);
    await patch({ quote: null });
    const l = await stored();
    expect(l.quote).toBeUndefined();
    expect(l.events.filter((e) => e.kind === "quote").map((e) => e.note)).toEqual(["1200", ""]);
  });

  it("sets a reminder with its text cut to size, and clears it", async () => {
    await patch({ remind: { at: "2026-11-20T17:00:00-08:00", text: "x".repeat(60) } });
    let l = await stored();
    expect(l.remind).toEqual({ at: "2026-11-21T01:00:00.000Z", text: "x".repeat(28) });
    await patch({ remind: null });
    l = await stored();
    expect(l.remind).toBeUndefined();
    expect(l.events.at(-1)).toMatchObject({ kind: "remind", note: "" });
  });

  it("keeps paper status, notes, lost reason and a licence", async () => {
    await patch({ contract: "Signed", release: "Sent", notes: "  call after 6  ", lostReason: "budget", licence: { use: "Web, 1 year", end: "2027-11-06" } });
    expect(await stored()).toMatchObject({ contract: "Signed", release: "Sent", notes: "call after 6", lostReason: "budget", licence: { use: "Web, 1 year", end: "2027-11-06" } });
    await patch({ notes: "   " });
    expect((await stored()).notes).toBeUndefined();
  });

  it("calls no Notion without a token", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await patch({ stage: "Confirmed", contract: "Sent" });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("patchLead: invoices marked by hand", () => {
  it("a new invoice takes the month's number and bumps the count", async () => {
    const { body } = await patch({ invoice: BILL });
    expect(body.lead?.invoices?.[0]).toMatchObject({ no: "1126", paid: 100 });
    expect(kv.data.get("invoices:1126")?.value).toBe("1");
  });

  it("paid adds the balance once, a second tap changes nothing, unpaid takes off what was added", async () => {
    await patch({ invoice: BILL });
    await patch({ invoicePaid: { no: "1126", paid: true } });
    let l = await stored();
    expect(l.invoices?.[0].paidAt).toBeTruthy();
    const paidEvents = () => l.events.filter((e) => e.kind === "invoice-paid");
    expect(paidEvents().map((e) => [e.note, e.amount])).toEqual([["1126 paid, $350.00", 350]]);
    await patch({ invoicePaid: { no: "1126", paid: true } });
    l = await stored();
    expect(paidEvents()).toHaveLength(1);
    await patch({ invoicePaid: { no: "1126", paid: false } });
    l = await stored();
    expect(l.invoices?.[0]).toMatchObject({ unpaid: true });
    expect(l.invoices?.[0].paidAt).toBeUndefined();
    expect(paidEvents().map((e) => [e.note, e.amount])).toEqual([["1126 paid, $350.00", 350], ["1126 unpaid again", -350]]);
  });

  it("can mark paid the invoice made in the same patch", async () => {
    const { status, body } = await patch({ invoice: BILL, invoicePaid: { no: "1126", paid: true } });
    expect(status).toBe(200);
    expect(body.lead?.invoices?.[0].paidAt).toBeTruthy();
  });
});
