import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY, INBOX_KEY as KEY } from "../fakes";
import { desk } from "../desk-routes";
import { sealer } from "@/lib/seal";
import { recordLead } from "@/lib/leads/lead-store";
import { eventsCsv, fillTemplate, leadsCsv, identity, manualLead, merge, stats } from "@/lib/leads/lead-crm";
import type { Lead } from "@/lib/leads/leads";

/* The desk as a CRM (`lib/leads/lead-crm.ts`, the routes under `app/api/leads`): leads
   added by hand, notes, reminders, details, quotes, merges, templates, the
   numbers and the export. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
});
const idOf = async (email: string) => (await sealer(LEADS_KEY)!).id(email);

describe("identity and manual leads", () => {
  it("keys a lead by address, else Instagram handle, else phone", () => {
    expect(identity({ email: " Maya@Example.com " })).toBe("maya@example.com");
    expect(identity({ ig: "@Maya.Shoots" })).toBe("ig:@maya.shoots");
    expect(identity({ phone: "(408) 555-0101" })).toBe("tel:4085550101");
    expect(identity({ email: "@nope", phone: "12" })).toBeNull();
  });

  it("adds one read, at the stage he picked, and refuses one with no way to reach them", () => {
    const l = manualLead({ name: " Ana ", ig: "ana.k", stage: "Quoted", source: "Instagram DM", notes: "Sister's wedding" }, "2026-11-04T10:00:00Z");
    expect(l).toMatchObject({ email: "ig:@ana.k", name: "Ana", stage: "Quoted", unread: false, ig: "@ana.k", source: "Instagram DM", notes: "Sister's wedding" });
    expect(manualLead({ name: "Ana" }, "x")).toEqual({ error: expect.any(String) });
  });
});

describe("merge", () => {
  const base = (o: Partial<Lead>): Lead => ({ email: "a@x.com", name: "A", stage: "Inquiry", stageAt: "2026-11-01T00:00:00Z", firstAt: "2026-11-01T00:00:00Z", lastAt: "2026-11-01T00:00:00Z", unread: false, events: [], ...o });
  it("keeps both timelines, the furthest stage, the latest booking and both notes", () => {
    const a = base({ notes: "likes red", events: [{ at: "2026-11-01T00:00:00Z", kind: "inquiry", ref: "msg:1" }] });
    const b = base({ email: "a@work.com", stage: "Confirmed", stageAt: "2026-11-03T00:00:00Z", firstAt: "2026-10-01T00:00:00Z", when: "2026-12-01T18:00:00Z", events: [{ at: "2026-11-03T00:00:00Z", kind: "booking", ref: "cal:1" }, { at: "2026-11-01T00:00:00Z", kind: "inquiry", ref: "msg:1" }] });
    const m = merge(a, b, "2026-11-04T00:00:00Z");
    expect(m).toMatchObject({ email: "a@x.com", stage: "Confirmed", firstAt: "2026-10-01T00:00:00Z", when: "2026-12-01T18:00:00Z" });
    expect(m.notes).toContain("likes red");
    expect(m.notes).toContain("a@work.com");
    expect(m.events.map((e) => e.kind)).toEqual(["inquiry", "booking", "merge"]);
  });
});

describe("templates, numbers, export", () => {
  it("fills a template for one lead", () => {
    expect(fillTemplate("Hi {first}, the {kind} on {when}.", { name: "Maya Okafor", kind: "intro-call", when: "2026-11-05T18:00:00Z" })).toBe("Hi Maya, the intro call on Thursday, November 5.");
  });

  it("counts inquiries and bookings by week, the reply time, the booked rate, sources and lost reasons", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    const mk = (o: Partial<Lead>): Lead => ({ email: "x", name: "x", stage: "Inquiry", stageAt: "2026-10-01T00:00:00Z", firstAt: "2026-10-01T00:00:00Z", lastAt: "2026-10-01T00:00:00Z", unread: false, events: [], ...o });
    const s = stats(
      [
        mk({ source: "instagram.com", stage: "Confirmed", quote: 900, events: [{ at: "2026-10-01T00:00:00Z", kind: "inquiry" }, { at: "2026-10-01T04:00:00Z", kind: "stage", note: "Replied" }, { at: "2026-10-05T00:00:00Z", kind: "stage", note: "Confirmed" }] }),
        mk({ source: "instagram.com", stage: "Lost", lostReason: "Price", events: [{ at: "2026-10-02T00:00:00Z", kind: "inquiry" }, { at: "2026-10-02T08:00:00Z", kind: "stage", note: "Replied" }] }),
        mk({ source: "google.com", stage: "Quoted", quote: 1500, firstAt: "2026-11-03T00:00:00Z" }),
        mk({ trashedAt: "2026-11-01T00:00:00Z" }),
      ],
      now,
    );
    expect(s.total).toBe(3);
    expect(s.replyHours).toBe(6);
    expect(s.bookedRate).toBe(0.5);
    expect(s.sources[0]).toEqual({ source: "instagram.com", leads: 2, booked: 1 });
    expect(s.lost).toEqual([{ reason: "Price", n: 1 }]);
    expect(s).toMatchObject({ pipeline: 1500, won: 900 });
    expect(s.weeks.reduce((n, w) => n + w.inquiries, 0)).toBe(3);
  });

  it("exports CSV with quotes escaped and formulas defused", () => {
    const out = leadsCsv([{ email: "ig:@a", name: '=HYPERLINK("x")', stage: "Inquiry", stageAt: "", firstAt: "", lastAt: "", unread: false, events: [], notes: 'say "hi",\nthen' }]);
    expect(out.split("\r\n")[0]).toMatch(/^name,email,phone/);
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain('"say ""hi"",\nthen"');
    expect(out).not.toContain("ig:@a");
  });

  it("leaves events of a lead with no address to mail out of the activity CSV", () => {
    const ev = { at: "2026-11-01T00:00:00Z", kind: "inquiry" as const };
    const out = eventsCsv([
      { lead: "a", email: "a@x.com", name: "Ana", event: ev },
      { lead: "b", email: "ig:@bo", name: "Bo", event: ev },
      { lead: "c", email: "tel:+14155550100", name: "Cy", event: ev },
    ]).trim().split("\r\n");
    expect(out).toEqual(["time,client,email,kind,detail,amount,lead id", "2026-11-01T00:00:00Z,Ana,a@x.com,inquiry,,,a"]);
  });
});

describe("the API", () => {
  it("adds a lead by hand, once, and lists it", async () => {
    const res = await desk("POST", "", { body: { name: "Ana", ig: "ana.k", stage: "Replied", source: "Referral" } });
    expect(res.status).toBe(200);
    expect((await desk("POST", "", { body: { name: "Ana again", ig: "@ANA.K" } })).status).toBe(409);
    expect((await desk("POST", "", { body: { name: "" } })).status).toBe(400);
    const { leads } = await (await desk("GET")).json();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: "Ana", stage: "Replied", unread: false });
    expect(leads[0]).not.toHaveProperty("source");
  });

  it("keeps notes, a reminder, details, a quote and a lost reason, with the reminder in the list", async () => {
    await recordLead({ INBOX: kv as never, LEADS_KEY }, "m@x.com", { event: { at: "2026-11-01T00:00:00Z", kind: "inquiry", ref: "msg:1" }, name: "Maya" });
    const key = `lead:${await idOf("m@x.com")}`;
    const patch = async (body: object) => (await desk("PATCH", "", { body: { id: key.slice(5), ...body } })).json();
    expect((await patch({ notes: "Wants red light" })).lead.notes).toBe("Wants red light");
    // Capped like the field, so the row shows it whole.
    expect((await patch({ remind: { at: "2026-11-06T17:00:00Z", text: "Send invoice, then send photos to select" } })).lead.remind.text).toHaveLength(28);
    expect((await patch({ remind: { at: "2026-11-06T17:00:00Z", text: "Send the quote" } })).lead.remind).toEqual({ at: "2026-11-06T17:00:00.000Z", text: "Send the quote" });
    expect((await patch({ details: { name: "Maya Okafor", phone: "408 555 0101", ig: "maya", company: "" } })).lead).toMatchObject({ name: "Maya Okafor", phone: "408 555 0101", ig: "@maya" });
    expect((await patch({ quote: 1200 })).lead.quote).toBe(1200);
    expect((await patch({ stage: "Lost", lostReason: "Dates" })).lead).toMatchObject({ stage: "Lost", lostReason: "Dates" });
    expect((await desk("PATCH", "", { body: { id: key.slice(5), quote: -5 } })).status).toBe(400);
    expect((await desk("PATCH", "", { body: { id: key.slice(5), remind: { at: "soon" } } })).status).toBe(400);
    const { leads } = await (await desk("GET")).json();
    expect(leads[0]).toMatchObject({ due: "2026-11-06T17:00:00.000Z", dueText: "Send the quote", quote: 1200 });
    expect(leads[0]).not.toHaveProperty("notes");
    expect((await patch({ remind: null })).lead).not.toHaveProperty("remind");
  });

  it("merges two records of one person, and the other goes for good", async () => {
    await recordLead({ INBOX: kv as never, LEADS_KEY }, "a@x.com", { event: { at: "2026-11-01T00:00:00Z", kind: "inquiry", ref: "msg:1" }, name: "A" });
    await recordLead({ INBOX: kv as never, LEADS_KEY }, "a@work.com", { event: { at: "2026-11-02T00:00:00Z", kind: "call", ref: "cal:1" }, name: "A" });
    const [a, b] = [`lead:${await idOf("a@x.com")}`, `lead:${await idOf("a@work.com")}`];
    // A merge whose patch fails keeps the other record.
    expect((await desk("PATCH", "", { body: { id: a.slice(5), mergeFrom: b.slice(5), invoicePaid: { no: "0000", paid: true } } })).status).toBe(404);
    expect(await kv.get(b)).not.toBeNull();
    expect(await kv.get(`log:${b.slice(5)}`)).not.toBeNull();
    const { lead } = await (await desk("PATCH", "", { body: { id: a.slice(5), mergeFrom: b.slice(5) } })).json();
    expect(lead).toMatchObject({ stage: "Call booked" });
    expect(await kv.get(b)).toBeNull();
    expect(await kv.get(`gone:${b.slice(5)}`)).not.toBeNull();
  });

  it("saves templates, serves the defaults until then, and answers stats and CSV", async () => {
    expect((await (await desk("GET", "/templates")).json()).templates.length).toBeGreaterThan(2);
    const saved = await (await desk("PUT", "/templates", { body: { templates: [{ name: "Hi", subject: "S", body: "B" }, { bad: 1 }] } })).json();
    // The quote nudges ride along, so a list saved before them still has them.
    expect(saved.templates[0]).toEqual({ id: "t0", name: "Hi", subject: "S", body: "B" });
    expect(saved.templates.map((t: { id: string }) => t.id)).toEqual(["t0", "nudge1", "nudge2", "nudge3"]);
    expect((await (await desk("GET", "/templates")).json()).templates).toHaveLength(4);
    await recordLead({ INBOX: kv as never, LEADS_KEY }, "m@x.com", { event: { at: "2026-11-01T00:00:00Z", kind: "inquiry", ref: "msg:1" }, name: "Maya", source: "instagram.com" });
    expect((await (await desk("GET", "/stats")).json()).stats.sources).toEqual([{ source: "instagram.com", leads: 1, booked: 0 }]);
    const file = await desk("GET", "/csv");
    expect(file.headers.get("content-type")).toContain("text/csv");
    expect(file.headers.get("cache-control")).toContain("no-store");
    expect(await file.text()).toContain("m@x.com");
  });
});
