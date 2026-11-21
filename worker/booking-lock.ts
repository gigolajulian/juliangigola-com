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

  // Each op of `LockOps`, typed against the same map the caller (`lockOp`) is. Ids arrive as JSON, so String() them.
  private ops(store: Store): { [K in keyof LockOps]: (arg: LockOps[K][0]) => Promise<LockOps[K][1]> } {
    const env = this.env;
    return {
      book: (arg) => this.serial(() => bookOwn(store, env.GCAL_OAUTH, arg, env.INBOX)),
      cancel: (id) => this.serial(() => cancelOwn(store, env.GCAL_OAUTH, String(id))),
      reschedule: ({ id, start }) => this.serial(() => rescheduleOwn(store, env.GCAL_OAUTH, id, start, env.INBOX)),
      due: async () => ({ records: await dueReminders(store) }),
      reminded: async (id) => ({ ok: (await markReminded(store, String(id)), true) }),
      dueHeads: async () => ({ records: await dueHeadsUp(store) }),
      headed: async (id) => ({ ok: (await markHeadsUp(store, String(id)), true) }),
      hours: async () => ({ hours: await readHours(store) }),
      // Checked by the route (`cleanHours`); queued so no booking reads half of it.
      setHours: (hours) => this.serial(async () => (await writeHours(store, hours), { hours })),
      get: async (id) => ({ record: (await findBooking(store, String(id))) ?? null }),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const { op, arg } = (await request.json()) as { op: keyof LockOps; arg: unknown };
    const ops = this.ops(this.state.storage);
    try {
      if (Object.hasOwn(ops, op)) return Response.json(await (ops[op] as (a: unknown) => Promise<unknown>)(arg));
      return Response.json({ error: "unknown op" }, { status: 400 });
    } catch (e) {
      console.error("booking lock", op, String(e));
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }
}
