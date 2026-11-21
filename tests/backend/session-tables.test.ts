import { describe, expect, it } from "vitest";
import { EVENTS } from "@/lib/booking/booking-rules";
import { SESSION_EVENTS } from "@/lib/booking/service-pages";
import { SESSION } from "@/lib/booking/deposit";
import { DEPOSIT, PAID, isPaid } from "@/lib/booking/paid";
import { LENGTH, SESSIONS } from "@/lib/flags/v3";

/* The session tables derived from `EVENTS` and `PAID` give the values they
   held when each was written by hand (2026-11-16), with Headshots and Studio
   digitals at 45 minutes (Julian). A change here is a change on the site. */

describe("session tables", () => {
  it("names each deposit the way it always did", () => {
    expect(SESSION).toEqual({ portraits: "Portraits", headshots: "Headshots", graduation: "Graduation photos", digitals: "Studio digitals", "model-test": "Model test" });
  });
  it("books the same events from /book", () => {
    expect(SESSION_EVENTS).toEqual({ portraits: "juliangigola/portraits", graduation: "juliangigola/graduation", headshots: "juliangigola/headshots", "studio-digitals": "juliangigola/digitals" });
  });
  it("keeps the V3 lengths", () => {
    expect(LENGTH).toEqual({ portraits: 60, graduation: 90, headshots: 45, "studio-digitals": 45, "model-test": 60, weddings: 480, consultation: 15, "music-photography": 15, "fashion-photography": 15, "brand-photography": 15, editorial: 15, events: 0 });
  });
  it("takes a deposit on the same sessions", () => {
    expect(Object.values(SESSIONS).filter((s) => s.paid).map((s) => s.slug)).toEqual(["portraits", "graduation", "headshots", "studio-digitals", "model-test"]);
    expect(PAID).toEqual(["portraits", "headshots", "graduation", "digitals", "model-test"]);
    expect(DEPOSIT).toEqual({ portraits: 250, headshots: 200, graduation: 200, digitals: 150, "model-test": 100 });
  });
  it("books only events that exist, a deposit exactly where PAID says", () => {
    for (const s of Object.values(SESSIONS)) {
      const ev = s.cal?.split("/")[1];
      if (ev) expect(EVENTS[ev], s.slug).toBeTruthy();
      expect(s.paid, s.slug).toBe(!!ev && isPaid(ev));
    }
  });
});

describe("session prices", () => {
  it("the home card shows the price set in /admin for every session it lists", async () => {
    const { SESSION_TYPES } = await import("@/lib/booking/sessions");
    for (const t of SESSION_TYPES) if (t.slug in SESSIONS) expect(SESSIONS[t.slug as keyof typeof SESSIONS].from).toBe(t.from);
  });
});
