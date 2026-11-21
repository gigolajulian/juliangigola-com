"use client";

import * as React from "react";
import { isPaid } from "@/lib/booking/paid";
import type { SlotsAnswer } from "@/lib/booking/slots";
import { AHEAD, iso, KEEP, recent, recentKey, type Slot } from "@/components/booking/time-picker-parts";

/**
 * The picker's open times (`/api/slots`) and the event they belong to, loaded on mount and again with `load(true)`.
 * `state` stays "loading" until the times come, "fallback" when they do not (or a paid event has no Stripe key).
 */
export function useSlots(username: string, slug: string, tz: string) {
  const [length, setLength] = React.useState(30);
  /** The event takes its place from the visitor (a studio session or their own address). */
  const [needsWhere, setNeedsWhere] = React.useState(false);
  const [session, setSession] = React.useState("");
  const [days, setDays] = React.useState<Record<string, Slot[]> | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "fallback">("loading");
  /* A paid session, its deposit taken here (`?deposit`, deposit-step.tsx). */
  const [paid, setPaid] = React.useState(false);

  const load = React.useCallback(async (fresh = false) => {
    const key = recentKey(username, slug, tz);
    try {
      const from = new Date();
      const to = new Date(Date.now() + AHEAD * 864e5);
      // No answer at all left "Loading times" up for good: past
      // 8 seconds the fallback takes over, as for any other failure.
      const signal = AbortSignal.timeout?.(8000);
      const hit = recent.get(key);
      // The event and its times in one (`app/api/slots`).
      const got = !fresh && hit && Date.now() - hit.at < KEEP ? hit.got : fetch(`/api/slots?slug=${slug}&start=${iso(from)}&end=${iso(to)}&timeZone=${encodeURIComponent(tz)}${fresh ? "&fresh" : ""}`, { signal })
        .then((r) => r.json() as Promise<SlotsAnswer>);
      if (got !== hit?.got) recent.set(key, { at: Date.now(), got });
      const slots = await got;
      if (slots.status !== "success") throw new Error("no times");
      const ev = slots.event;
      // A paid event's deposit is taken here (deposit-step.tsx) where the
      // build has Stripe's key; without it, the fallback.
      // Paid by the site's list (lib/booking/paid.ts).
      const owes = isPaid(slug);
      if (owes && !process.env.NEXT_PUBLIC_STRIPE_PK) {
        setState("fallback");
        return;
      }
      setPaid(owes);
      setLength(ev.lengthInMinutes);
      setSession(ev.title);
      setNeedsWhere(ev.locations.some((l) => l.type === "attendeeDefined"));
      setDays(slots.data);
      setState("ready");
    } catch {
      recent.delete(key);
      // Only before the times have come. A reload after a booking failed
      // keeps the times it had, and the form with what was typed in it.
      setState((s) => (s === "ready" ? s : "fallback"));
    }
  }, [username, slug, tz]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { length, needsWhere, session, days, state, paid, load };
}
