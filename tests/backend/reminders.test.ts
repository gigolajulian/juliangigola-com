import { beforeEach, describe, expect, it } from "vitest";
import { FakeEmail, FakeStore, fakeLock } from "./fakes";
import { saveBooking, type BookingRecord } from "@/lib/booking-engine";
import { BookingLock } from "@/worker/booking-lock";
import { remind } from "@/worker/index";

/* The hourly cron in the lock Worker (`worker/index.ts`): a reminder goes
   to each live booking 23 to 24 hours out, once; a booking made inside its
   last day, a cancelled one and one already reminded get none. A run that
   was skipped is made up by the next. */

const H = 36e5;
let store: FakeStore;
let client: FakeEmail;
let env: Parameters<typeof remind>[0];

const rec = (id: string, hoursOut: number, more: Partial<BookingRecord> = {}): BookingRecord => ({
  id,
  eventId: `ev_${id}`,
  slug: "portraits",
  session: "Portraits",
  start: new Date(Date.now() + hoursOut * H).toISOString(),
  end: new Date(Date.now() + (hoursOut + 1) * H).toISOString(),
  timeZone: "America/Los_Angeles",
  name: "QA Test",
  email: `${id}@example.com`,
  at: new Date(Date.now() - 7 * 24 * H).toISOString(),
  ...more,
});

beforeEach(() => {
  store = new FakeStore();
  client = new FakeEmail();
  env = { BOOKING_LOCK: fakeLock(new BookingLock({ storage: store }, {})) as never, CLIENT_EMAIL: client as never, BOOKING_SECRET: "booking-secret-for-tests" };
});

describe("reminders", () => {
  it("mails each live booking once in its last day, and no other", async () => {
    await saveBooking(store, rec("due", 23.5, { intent: "pi_TEST1234567890" }));
    await saveBooking(store, rec("early", 25));
    await saveBooking(store, rec("started", -1));
    // An hour was skipped: 22 hours out and never reminded still gets one.
    await saveBooking(store, rec("missed", 22));
    await saveBooking(store, rec("gone", 23.5, { cancelled: new Date().toISOString() }));
    await saveBooking(store, rec("fresh", 23.5, { at: new Date().toISOString() }));

    expect(await remind(env)).toBe(2);
    expect(client.sent.map((x) => x.to)).toEqual([expect.objectContaining({ email: "due@example.com" }), expect.objectContaining({ email: "missed@example.com" })]);
    const m = client.sent[0];
    expect(m.subject).toMatch(/^Tomorrow: Portraits, /);
    expect(String(m.text)).toContain("See you tomorrow.");
    expect(String(m.text)).toContain("a cancel keeps the deposit");
    expect(String(m.text)).toContain("https://juliangigola.com/booking/due?t=");

    // The next hour does not send it again.
    expect(await remind(env)).toBe(0);
    expect(client.sent).toHaveLength(2);
  });

  it("a call reads as a call", async () => {
    await saveBooking(store, rec("call", 23.5, { slug: "music-call", session: "Music call", call: true, where: "https://meet.google.com/abc-defg-hij" }));
    await remind(env);
    expect(String(client.sent[0].text)).toContain("Talk tomorrow.");
    expect(String(client.sent[0].text)).not.toContain("deposit");
  });
});
