import { describe, expect, it } from "vitest";
import {
  bookingEnquiry,
  companySite,
  contextLines,
  cooldown,
  COOLDOWN_MS,
  dayKey,
  emailCopy,
  enquiry,
  enquiryKey,
  isPicture,
  problems,
  replyLink,
  summary,
  takePicks,
  takeUploads,
  visitContext,
  waitPhrase,
} from "@/lib/inbox";

/* The inbox's pure half: keys, validation, the cooldown and the copy. */

const base = { type: "portrait", name: "Ana Ruiz", email: "ana@studio.co", detail: "", message: "Hi" };

describe("keys", () => {
  it("sort by time: padded so a shorter stamp never sorts above a longer one", () => {
    expect(enquiryKey(5, "x")).toBe("msg:000000000000005:x");
    expect(enquiryKey(9, "a") < enquiryKey(10, "a")).toBe(true);
    expect(dayKey(Date.parse("2026-11-10T23:59:00Z"))).toBe("count:2026-11-10");
  });
});

describe("cooldown", () => {
  it("lets a new sender and a past-the-wait sender through", () => {
    expect(cooldown(null, 1000)).toEqual({ ok: true });
    expect(cooldown(0, COOLDOWN_MS)).toEqual({ ok: true });
  });
  it("treats a clock that went backwards as fresh", () => {
    expect(cooldown(5000, 1000)).toEqual({ ok: true });
  });
  it("rounds the wait up, never to zero", () => {
    expect(cooldown(0, COOLDOWN_MS - 1)).toEqual({ ok: false, waitSeconds: 1 });
    expect(cooldown(0, 0)).toEqual({ ok: false, waitSeconds: 300 });
  });
  it("says the wait in words", () => {
    expect(waitPhrase(1)).toBe("1 second");
    expect(waitPhrase(45)).toBe("45 seconds");
    expect(waitPhrase(60)).toBe("1 minute");
    expect(waitPhrase(61)).toBe("2 minutes");
  });
});

describe("problems", () => {
  it("is empty for a sendable enquiry and names each missing field", () => {
    expect(problems({ name: "A", email: "a@b.c", message: "m" })).toEqual({});
    expect(Object.keys(problems({ name: "", email: "", message: "" })).sort()).toEqual(["email", "message", "name"]);
  });
  it("rejects what cannot be an address and fields past the cap", () => {
    expect(problems({ name: "A", email: "nope", message: "m" }).email).toMatch(/does not look/);
    expect(problems({ name: "x".repeat(101), email: "a@b.c", message: "m" }).name).toBeTruthy();
    expect(problems({ name: "A", email: "a@b.c", message: "x".repeat(5001) }).message).toBeTruthy();
  });
});

describe("enquiry", () => {
  it("keeps header fields on one line and unknown types as other", () => {
    const e = enquiry({ ...base, type: "hack", name: "x\r\nBcc: evil@x.y" }, 0, "id1", "US");
    expect(e.type).toBe("other");
    expect(e.name).not.toMatch(/[\r\n]/);
    expect(e).toMatchObject({ id: "id1", at: "1970-01-01T00:00:00.000Z", read: false, country: "US" });
  });
  it("caps every field", () => {
    const e = enquiry({ ...base, message: "m".repeat(6000), detail: "d".repeat(300) }, 0, "i");
    expect(e.message).toHaveLength(5000);
    expect(e.detail).toHaveLength(200);
  });
});

describe("visitContext", () => {
  it("keeps the site's own paths and a referrer's host, drops the rest", () => {
    const c = visitContext(
      JSON.stringify({ page: "/book/portraits", path: "javascript:alert(1)", referrer: "https://www.google.com/search?q=x", device: "fridge", trail: ["/a", "nope", "/b"] }),
      "San Jose",
    );
    expect(c).toEqual({ page: "/book/portraits", referrer: "www.google.com", trail: ["/a", "/b"], place: "San Jose" });
  });
  it("drops the site's own host and answers nothing for nothing", () => {
    expect(visitContext(JSON.stringify({ referrer: "https://juliangigola.com/x" }))).toBeUndefined();
    expect(visitContext("not json")).toBeUndefined();
  });
});

describe("uploads and picks", () => {
  it("checks a picture's first bytes against its type", () => {
    expect(isPicture(new Uint8Array([0xff, 0xd8, 0xff, 0]), "image/jpeg")).toBe(true);
    expect(isPicture(new Uint8Array([0x3c, 0x73, 0x76, 0x67]), "image/jpeg")).toBe(false);
    const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic")]);
    expect(isPicture(heic, "image/heic")).toBe(true);
    expect(isPicture(heic, "image/svg+xml")).toBe(false);
  });
  it("takes real pictures only, up to the room left", async () => {
    const jpeg = (n: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2])], n, { type: "image/jpeg" });
    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    const liar = new File(["<svg/>"], "x.jpg", { type: "image/jpeg" });
    const got = await takeUploads([jpeg("a.jpg"), svg, liar, jpeg("b.jpg"), jpeg("c.jpg")], 3);
    expect(got.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(await takeUploads([jpeg("a.jpg")], 0)).toEqual([]);
  });
  it("takes picks of the site's shape, CRLF split, capped", () => {
    expect(takePicks("/work/zoe/16.jpg\r\nhttps://evil.x/a.jpg\r\n/work/../x.jpg\n/hero/a.jpg")).toEqual(["/work/zoe/16.jpg", "/hero/a.jpg"]);
    expect(takePicks(Array(12).fill("/covers/a.jpg").join("\n"))).toHaveLength(8);
  });
});

describe("context and copy", () => {
  it("reads a company site off a work address only", () => {
    expect(companySite("ana@Studio.co")).toBe("https://studio.co");
    expect(companySite("ana@gmail.com")).toBeUndefined();
    expect(companySite("ana@sjsu.edu")).toBeUndefined();
    expect(companySite("nope")).toBeUndefined();
  });
  it("lists the visit as lines", () => {
    const e = { ...enquiry(base, 0, "i"), context: { page: "/book", referrer: "google.com", landing: "/", utm: "ig" } };
    expect(contextLines(e)).toEqual(["Sent from: /book", "Came in: google.com to / (ig)", "Company: https://studio.co"]);
  });
  it("writes a subject that names the job and an escaped HTML body", () => {
    const e = enquiry({ ...base, message: "<b>a lookbook shoot</b> for spring with a long enough line to be cut somewhere near sixty" }, 0, "i");
    const m = emailCopy(e);
    expect(m.subject.startsWith("Portrait inquiry · Ana Ruiz · ")).toBe(true);
    expect(m.subject.endsWith("…")).toBe(true);
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.html).not.toContain("<b>a");
    expect(m.text).toContain("From: Ana Ruiz <ana@studio.co>");
  });
  it("lists picks with their look, and the inline image only when fetched", () => {
    const e = { ...enquiry(base, 0, "i"), picks: ["/work/a/1.jpg", "/work/b/2.jpg"] };
    const m = emailCopy(e, { "/work/a/1.jpg": "hard light" }, ["/work/b/2.jpg"]);
    expect(m.text).toContain("https://juliangigola.com/work/a/1.jpg  hard light");
    expect(m.html).toContain('src="cid:pick-1"');
    expect(m.html).not.toContain("cid:pick-0");
  });
  it("summarises a row without the body, and a booking with its detail", () => {
    const s = summary({ ...enquiry({ ...base, detail: "x" }, 0, "i"), deposit: "https://stripe" });
    expect(s).not.toHaveProperty("message");
    expect(s).not.toHaveProperty("detail");
    expect(s.deposit).toBe("https://stripe");
    const b = bookingEnquiry({ eventTitle: "Portraits", startTime: "2026-11-21T22:00:00Z", attendees: [{ name: "Kai", email: "k@x.co" }] }, 0, "b");
    expect(b.type).toBe("booking");
    expect(b.detail).toBe("Portraits · Sat, Nov 21, 2:00 PM PST");
    expect(b.message).toBe("Booked on Cal.com. No notes.");
    expect(summary(b).detail).toBe(b.detail);
  });
  it("writes a reply link with the first name and the message quoted", () => {
    const link = replyLink(enquiry({ ...base, message: "line one\nline two" }, 0, "i"));
    expect(link.startsWith("mailto:ana%40studio.co?subject=Re%3A%20your%20portrait%20inquiry")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Hi Ana,");
    expect(decodeURIComponent(link)).toContain("> line one\n> line two");
  });
});
