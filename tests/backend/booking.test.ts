import { describe, expect, it } from "vitest";
import { BOOKING_PAGES, BOOK_MENU, CAL_EVENTS, bookingHref, bookingPage, calEvent, pageForSession } from "@/lib/booking";
import { BOOKING_SLUGS } from "@/lib/booking-slugs";

/* The booking pages and the homepage booking menu (`lib/booking.ts`),
   against the slug list next.config reads (`lib/booking-slugs.ts`). */

describe("booking pages", () => {
  it("has one page per booking slug, and no other", () => {
    expect(BOOKING_PAGES.map((p) => p.slug).sort()).toEqual([...BOOKING_SLUGS].sort());
  });

  it("finds a page by slug and by session, and links it at the root", () => {
    const p = bookingPage("headshots")!;
    expect(bookingHref(p)).toBe("/headshots");
    expect(bookingPage("nope")).toBeUndefined();
    for (const page of BOOKING_PAGES) if (page.session) expect(pageForSession(page.session)).toBe(page);
  });

  it("gives every page a cover, a title and a way back", () => {
    for (const p of BOOKING_PAGES) {
      expect(p.tiles.length).toBeGreaterThan(0);
      expect(p.title).toBeTruthy();
      expect(p.back.href.startsWith("/")).toBe(true);
    }
  });
});

describe("calEvent", () => {
  it("names a session's Cal.com event, or nothing", () => {
    expect(calEvent("portraits")).toBe(CAL_EVENTS.portraits);
    expect(calEvent("weddings")).toBeUndefined();
    expect(calEvent()).toBeUndefined();
  });
});

describe("BOOK_MENU", () => {
  it("lists each way to book once, every time slot with its calendar", () => {
    const slugs = BOOK_MENU.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const m of BOOK_MENU) if (m.group === "time") expect(m.cal).toBeTruthy();
    for (const m of BOOK_MENU) expect(m.cal || m.form).toBeTruthy();
  });
});
