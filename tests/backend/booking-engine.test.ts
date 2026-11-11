import { beforeEach, describe, expect, it } from "vitest";
import { FakeStore } from "./fakes";
import {
  bookOwn,
  cancelOwn,
  dueReminders,
  findBooking,
  liveHours,
  lockOp,
  clientView,
  markReminded,
  readHours,
  saveBooking,
  writeHours,
  type BookingRecord,
} from "@/lib/booking/booking-engine";
import { DEFAULT_HOURS } from "@/lib/booking/booking-rules";

/* The record keeping of the site's own engine (`lib/booking/booking-engine.ts`),
   the parts that never reach Google: what the client page may see, which
   bookings are due a reminder, and the refusals before a calendar call. */

const NOW = Date.parse("2026-11-10T18:00:00Z");
const H = 36e5;
const rec = (id: string, over: Partial<BookingRecord> = {}): BookingRecord => ({
  id,
  eventId: `ev-${id}`,
  slug: "portraits",
  session: "Portraits",
  start: new Date(NOW + 20 * H).toISOString(),
  end: new Date(NOW + 21 * H).toISOString(),
  timeZone: "America/Los_Angeles",
  name: "Ana Lee",
  email: "ana@example.com",
  phone: "+1 408 555 0100",
  intent: "pi_123",
  at: new Date(NOW - 72 * H).toISOString(),
  ...over,
});

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("clientView", () => {
  it("shows the client page no email, phone or deposit id", () => {
    const m = clientView(rec("a"));
    expect(m).not.toHaveProperty("email");
    expect(m).not.toHaveProperty("phone");
    expect(m).not.toHaveProperty("intent");
    expect(m).toMatchObject({ id: "a", paid: true, cancelled: false });
  });
});

describe("hours in the store", () => {
  it("reads the defaults until hours are written", async () => {
    expect(await readHours(store)).toEqual(DEFAULT_HOURS);
    const h = { week: Array(7).fill(null) };
    await writeHours(store, h);
    expect(await readHours(store)).toEqual(h);
  });
});

describe("dueReminders", () => {
  it("picks live bookings within a day that were made before that day", async () => {
    await saveBooking(store, rec("due"));
    await saveBooking(store, rec("far", { start: new Date(NOW + 30 * H).toISOString() }));
    await saveBooking(store, rec("past", { start: new Date(NOW - H).toISOString() }));
    await saveBooking(store, rec("late", { at: new Date(NOW - H).toISOString() }));
    await saveBooking(store, rec("gone", { cancelled: new Date(NOW).toISOString() }));
    await saveBooking(store, rec("sent", { reminded: new Date(NOW).toISOString() }));
    expect((await dueReminders(store, NOW)).map((r) => r.id)).toEqual(["due"]);
  });

  it("stops listing a booking once it is marked reminded", async () => {
    await saveBooking(store, rec("due"));
    await markReminded(store, "due", NOW);
    expect((await findBooking(store, "due"))?.reminded).toBe(new Date(NOW).toISOString());
    expect(await dueReminders(store, NOW)).toEqual([]);
  });
});

describe("refusals before any calendar call", () => {
  it("cancels nothing missing, cancelled or past", async () => {
    await saveBooking(store, rec("gone", { cancelled: "2026-11-01T00:00:00Z" }));
    await saveBooking(store, rec("old", { start: "2020-01-01T18:00:00Z" }));
    expect(await cancelOwn(store, undefined, "nope")).toEqual({ ok: false, reason: "missing" });
    expect(await cancelOwn(store, undefined, "gone")).toEqual({ ok: false, reason: "cancelled" });
    expect(await cancelOwn(store, undefined, "old")).toEqual({ ok: false, reason: "past" });
  });

  it("refuses an unknown event and books a repeated deposit once", async () => {
    const b = { slug: "portraits", start: "2026-11-20T18:00:00Z", timeZone: "America/Los_Angeles", name: "Ana", email: "ana@example.com", engine: "own" as const };
    expect(await bookOwn(store, undefined, { ...b, slug: "skydiving" })).toEqual({ ok: false, reason: "unknown" });
    const first = rec("paid");
    await saveBooking(store, first);
    await store.put("i:pi_123", "paid");
    expect(await bookOwn(store, undefined, { ...b, intent: "pi_123" })).toEqual({ ok: true, record: first });
  });
});

describe("the lock", () => {
  it("throws when it is not bound, and hours fall back to the defaults", async () => {
    await expect(lockOp({}, "hours", null)).rejects.toThrow("BOOKING_LOCK is not bound");
    expect(await liveHours({})).toEqual(DEFAULT_HOURS);
  });

  it("surfaces the lock's own error", async () => {
    const env = {
      BOOKING_LOCK: {
        idFromName: (n: string) => n,
        get: () => ({ fetch: async () => Response.json({ error: "busy" }, { status: 500 }) }),
      },
    };
    await expect(lockOp(env, "book", {} as never)).rejects.toThrow("booking lock book: busy");
  });
});
