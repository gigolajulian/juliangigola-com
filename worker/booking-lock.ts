import { bookOwn, cancelOwn, dueHeadsUp, dueReminders, findBooking, markHeadsUp, markReminded, readHours, rescheduleOwn, writeHours, type LockOps, type Store } from "../lib/booking/booking-engine";

/* ── the booking lock: one Durable Object for hello@'s calendar ─────
 * Every booking passes through `serial`, so a recheck and its insert
 * finish before the next booking's recheck starts. Its storage holds the
 * booking records (`lib/booking/booking-engine.ts`). Reached by fetch, not RPC,
 * so it needs no runtime import and runs the same in the tests.
 * ─────────────────────────────────────────────────────────────── */

export class BookingLock {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private state: { storage: Store },
    private env: { GCAL_OAUTH?: string; INBOX?: Parameters<typeof bookOwn>[3] },
  ) {}

  /* An await inside a DO lets the next request in (fetch to Google opens
     the input gate), so the order is kept by hand. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async fetch(request: Request): Promise<Response> {
    const { op, arg } = (await request.json()) as { op: keyof LockOps; arg: unknown };
    const store = this.state.storage;
    try {
      if (op === "book") return Response.json(await this.serial(() => bookOwn(store, this.env.GCAL_OAUTH, arg as LockOps["book"][0], this.env.INBOX)));
      if (op === "cancel") return Response.json(await this.serial(() => cancelOwn(store, this.env.GCAL_OAUTH, String(arg))));
      if (op === "reschedule") {
        const { id, start } = arg as LockOps["reschedule"][0];
        return Response.json(await this.serial(() => rescheduleOwn(store, this.env.GCAL_OAUTH, id, start, this.env.INBOX)));
      }
      if (op === "due") return Response.json({ records: await dueReminders(store) });
      if (op === "reminded") return Response.json({ ok: (await markReminded(store, String(arg)), true) });
      if (op === "dueHeads") return Response.json({ records: await dueHeadsUp(store) });
      if (op === "headed") return Response.json({ ok: (await markHeadsUp(store, String(arg)), true) });
      if (op === "hours") return Response.json({ hours: await readHours(store) });
      // Checked by the route (`cleanHours`); queued so no booking reads half of it.
      if (op === "setHours") return Response.json({ hours: await this.serial(async () => (await writeHours(store, arg as LockOps["setHours"][0]), arg)) });
      if (op === "get") return Response.json({ record: (await findBooking(store, String(arg))) ?? null });
      return Response.json({ error: "unknown op" }, { status: 400 });
    } catch (e) {
      console.error("booking lock", op, String(e));
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }
}
