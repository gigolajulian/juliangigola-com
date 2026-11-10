import { describe, expect, it } from "vitest";
import { bookingToken, manageLinks, tokenOpens } from "@/lib/booking-token";

/* The client's reschedule and cancel links (`lib/booking-token.ts`). */

const SECRET = "booking-secret-for-tests";
const NOW = Date.parse("2026-11-10T18:00:00Z");
const LATER = NOW + 864e5;

describe("booking tokens", () => {
  it("opens the booking it was made for until it expires", async () => {
    const t = await bookingToken(SECRET, "abc123", LATER);
    expect(await tokenOpens(SECRET, "abc123", t, NOW)).toBe(true);
    expect(await tokenOpens(SECRET, "abc123", t, LATER + 1000)).toBe(false);
  });

  it("does not open another booking, another secret, or a garbled token", async () => {
    const t = await bookingToken(SECRET, "abc123", LATER);
    expect(await tokenOpens(SECRET, "other", t, NOW)).toBe(false);
    expect(await tokenOpens("another-secret", "abc123", t, NOW)).toBe(false);
    expect(await tokenOpens(undefined, "abc123", t, NOW)).toBe(false);
    expect(await tokenOpens(SECRET, "abc123", null, NOW)).toBe(false);
    expect(await tokenOpens(SECRET, "abc123", t.slice(0, -1), NOW)).toBe(false);
  });

  it("builds both links, good until a day after the session, or none without a secret", async () => {
    const r = { id: "abc123", start: "2026-11-20T18:00:00Z" };
    expect(await manageLinks(undefined, r)).toBeNull();
    const links = (await manageLinks(SECRET, r))!;
    expect(links.reschedule).toMatch(/^https:\/\/juliangigola\.com\/booking\/abc123\?t=\d+\.[\w-]{43}&do=reschedule$/);
    expect(links.cancel.replace("&do=cancel", "")).toBe(links.reschedule.replace("&do=reschedule", ""));
    const t = new URL(links.cancel).searchParams.get("t");
    expect(await tokenOpens(SECRET, "abc123", t, Date.parse(r.start) + 864e5 - 1000)).toBe(true);
    expect(await tokenOpens(SECRET, "abc123", t, Date.parse(r.start) + 864e5 + 1000)).toBe(false);
  });
});
