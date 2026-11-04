/* eslint-disable @typescript-eslint/no-explicit-any -- fakes of Google's JSON */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgetToken } from "@/lib/gcal";
import { busyAll, EXTRA_KEY, icsBusy } from "@/lib/slots";
import { FakeKV } from "./fakes";

/* The Leads app's Calendar (`app/api/calendar`): blocks are events on
   hello@, extra calendars (Google ids, ICS links) close slots but are only
   read, and one that fails is skipped, never the whole calendar. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { GET, POST } = await import("@/app/api/calendar/route");

const SECRET = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
const KEY = "k";
const req = (method: string, body?: unknown, query = "") =>
  new Request(`https://juliangigola.com/api/calendar${query}`, { method, headers: { "x-inbox-key": KEY }, body: body ? JSON.stringify(body) : undefined });

type Call = { url: string; method: string; body?: any };
let kv: FakeKV;
let calls: Call[];
let event: any;
let ics: string;
let freebusy: any;

beforeEach(() => {
  forgetToken();
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, GCAL_OAUTH: SECRET };
  calls = [];
  event = { id: "e1", start: { date: "2026-11-20" }, end: { date: "2026-11-21" }, extendedProperties: { private: { jgBlock: "1" } } };
  ics = "";
  freebusy = { calendars: { primary: { busy: [] } } };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    if (url.endsWith(".ics")) return ics ? new Response(ics) : new Response("", { status: 404 });
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes("/freeBusy")) return Response.json(freebusy);
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (url.includes("/events?") && method === "GET") return Response.json({ items: [event] });
    return Response.json(event);
  });
});

const inserted = () => calls.find((c) => c.method === "POST" && c.url.includes("/events"))!;

describe("icsBusy", () => {
  it("reads UTC, TZID, all-day and DURATION, skips cancelled and free", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "DTSTART:20261120T200000Z", "DTEND:20261121T040000Z", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;TZID=America/Los_Angeles:20261122T120000", "DTEND;TZID=America/Los_Angeles:20261122T210000", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261125", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;TZID=Pacific Standard Time:20261126T090000", "DURATION:PT8H", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART:20261127T200000Z", "DTEND:20261127T210000Z", "STATUS:CANCELLED", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART:20261128T200000Z", "DTEND:20261128T210000Z", "TRANSP:TRANSPARENT", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(icsBusy(text).map((b) => [new Date(b.start).toISOString(), new Date(b.end).toISOString()])).toEqual([
      ["2026-11-20T20:00:00.000Z", "2026-11-21T04:00:00.000Z"],
      ["2026-11-22T20:00:00.000Z", "2026-11-23T05:00:00.000Z"],
      ["2026-11-25T08:00:00.000Z", "2026-11-26T08:00:00.000Z"],
      // An unknown zone name reads as Pacific.
      ["2026-11-26T17:00:00.000Z", "2026-11-27T01:00:00.000Z"],
    ]);
  });
});

describe("busyAll", () => {
  const A = Date.parse("2026-11-20T00:00:00Z");
  const B = Date.parse("2026-11-30T00:00:00Z");

  it("adds Google extras to freeBusy and ICS spans, labelled", async () => {
    ics = "BEGIN:VEVENT\nDTSTART:20261121T200000Z\nDTEND:20261121T220000Z\nEND:VEVENT";
    freebusy = { calendars: { primary: { busy: [] }, "me@gmail.com": { busy: [{ start: "2026-11-22T20:00:00Z", end: "2026-11-22T21:00:00Z" }] } } };
    const out = await busyAll(SECRET, A, B, [{ label: "Personal", src: "me@gmail.com" }, { label: "SGH", src: "https://shifts.example.com/a.ics" }]);
    expect(calls[0].body.items).toEqual([{ id: "primary" }, { id: "me@gmail.com" }]);
    expect(out.busy.map((b) => b.label).sort()).toEqual(["Personal", "SGH"]);
    expect(out.failed).toEqual([]);
  });

  it("skips an extra it cannot read, but never hello@ itself", async () => {
    freebusy = { calendars: { primary: { busy: [] }, "x@gmail.com": { errors: [{ reason: "notFound" }] } } };
    const out = await busyAll(SECRET, A, B, [{ label: "X", src: "x@gmail.com" }, { label: "Dead", src: "https://gone.example.com/b.ics" }]);
    expect(out.failed.sort()).toEqual(["Dead", "X"]);
    freebusy = { calendars: { primary: { errors: [{ reason: "x" }] } } };
    await expect(busyAll(SECRET, A, B, [])).rejects.toThrow();
  });
});

describe("/api/calendar", () => {
  it("is gated", async () => {
    const res = await GET(new Request("https://juliangigola.com/api/calendar?from=2026-11-01&to=2026-11-30"));
    expect(res.status).toBe(401);
  });

  it("blocks whole days as an opaque, marked, all-day event", async () => {
    expect((await POST(req("POST", { block: { from: "2026-11-20", to: "2026-11-22" } }))).status).toBe(200);
    expect(inserted().url).toContain("sendUpdates=none");
    expect(inserted().body).toMatchObject({ summary: "Blocked", transparency: "opaque", start: { date: "2026-11-20" }, end: { date: "2026-11-23" }, extendedProperties: { private: { jgBlock: "1" } } });
  });

  it("blocks a time range on one day in Pacific", async () => {
    await POST(req("POST", { block: { from: "2026-11-20", start: "14:00", end: "18:00" } }));
    expect(inserted().body.start).toEqual({ dateTime: "2026-11-20T14:00:00", timeZone: "America/Los_Angeles" });
    expect((await POST(req("POST", { block: { from: "2026-11-20", to: "2026-11-21", start: "14:00", end: "18:00" } }))).status).toBe(400);
    expect((await POST(req("POST", { block: { from: "2026-11-20", start: "18:00", end: "14:00" } }))).status).toBe(400);
  });

  it("unblocks only its own blocks, never a booking", async () => {
    expect((await POST(req("POST", { unblock: "e1" }))).status).toBe(200);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    calls = [];
    event = { ...event, extendedProperties: { private: { jgBooking: "abc" } } };
    expect((await POST(req("POST", { unblock: "e1" }))).status).toBe(400);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("adds and drops extras, and never shows an ICS link in full", async () => {
    expect((await POST(req("POST", { extra: { label: "SGH", src: "https://shifts.example.com/secret-token.ics" } }))).status).toBe(200);
    expect((await POST(req("POST", { extra: { label: "Bad", src: "javascript:alert(1)" } }))).status).toBe(400);
    expect(JSON.parse((await kv.get(EXTRA_KEY))!)).toHaveLength(1);
    ics = "BEGIN:VEVENT\nDTSTART:20261121T200000Z\nDTEND:20261121T220000Z\nEND:VEVENT";
    const out = await (await GET(req("GET", undefined, "?from=2026-11-20&to=2026-11-30"))).json();
    expect(out.extras).toEqual([{ label: "SGH", src: "shifts.example.com", ics: true, failed: false }]);
    expect(JSON.stringify(out)).not.toContain("secret-token");
    expect(out.busy[0]).toMatchObject({ label: "SGH" });
    expect(out.events[0]).toMatchObject({ id: "e1", block: true, allDay: true, start: "2026-11-20T08:00:00.000Z" });
    await POST(req("POST", { drop: "SGH" }));
    expect(JSON.parse((await kv.get(EXTRA_KEY))!)).toEqual([]);
  });
});
