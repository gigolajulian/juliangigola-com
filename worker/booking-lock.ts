import { bookOwn, cancelOwn, findBooking, rescheduleOwn, type BookInput, type Store } from "../lib/booking-engine";

/* ── the booking lock: one Durable Object for hello@'s calendar ─────
 * Every booking passes through `serial`, so a recheck and its insert
 * finish before the next booking's recheck starts. Its storage holds the
 * booking records (`lib/booking-engine.ts`). Reached by fetch, not RPC,
 * so it needs no runtime import and runs the same in the tests.
 * ─────────────────────────────────────────────────────────────── */

export class BookingLock {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private state: { storage: Store },
    private env: { GCAL_OAUTH?: string },
  ) {}

  /* An await inside a DO lets the next request in (fetch to Google opens
     the input gate), so the order is kept by hand. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async fetch(request: Request): Promise<Response> {
    const { op, arg } = (await request.json()) as { op: string; arg: unknown };
    const store = this.state.storage;
    try {
      if (op === "book") return Response.json(await this.serial(() => bookOwn(store, this.env.GCAL_OAUTH, arg as BookInput)));
      if (op === "cancel") return Response.json(await this.serial(() => cancelOwn(store, this.env.GCAL_OAUTH, String(arg))));
      if (op === "reschedule") {
        const { id, start } = arg as { id: string; start: string };
        return Response.json(await this.serial(() => rescheduleOwn(store, this.env.GCAL_OAUTH, id, start)));
      }
      if (op === "get") return Response.json({ record: (await findBooking(store, String(arg))) ?? null });
      return Response.json({ error: "unknown op" }, { status: 400 });
    } catch (e) {
      console.error("booking lock", op, String(e));
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }
}
