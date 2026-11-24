import * as React from "react";
import { takesDeposit } from "@/lib/booking/paid";
import type { SlotsAnswer } from "@/lib/booking/slots";
import { AHEAD } from "@/components/booking/picker/parts";
import { localDayKey } from "@/components/booking/flow";
import { getJson } from "@/lib/http";
import { DAY_MS } from "@/lib/time-zone";

/* An event's details and times, kept a minute, so a picker built again
   (the homepage menu builds one per row pointed at) does not ask the
   server again. A reload after a failed booking asks fresh. */
const KEEP = 60_000;
const recent = new Map<string, { at: number; got: Promise<SlotsAnswer> }>();
/** The key an event's times are kept under. */
const recentKey = (username: string, slug: string, tz: string) => `${username}/${slug}/${tz}`;
/** Forget an event's kept times, so the next picker asks fresh (a time just taken). */
export const forgetTimes = (username: string, slug: string, tz: string) => void recent.delete(recentKey(username, slug, tz));
/** Forget every kept answer (tests start each case fresh). */
export const forgetAllTimes = () => recent.clear();
/** An event's kept answer while it is under a minute old, else undefined. */
const peek = (key: string) => {
  const hit = recent.get(key);
  return hit && Date.now() - hit.at < KEEP ? hit.got : undefined;
};

/* The picker's open times and its event, fetched from `/api/slots`
   (`use-picker.tsx` loads them once it mounts). */
export function useSlots(username: string, slug: string, tz: string) {
  const [length, setLength] = React.useState(30);
  /** The event takes its place from the visitor (a studio session or their own address). */
  const [needsWhere, setNeedsWhere] = React.useState(false);
  const [session, setSession] = React.useState("");
  const [days, setDays] = React.useState<Record<string, string[]> | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "fallback">("loading");
  /* A paid session, its deposit taken here (`?deposit`, deposit-step.tsx). */
  const [paid, setPaid] = React.useState(false);

  const load = React.useCallback(async (fresh = false) => {
    const key = recentKey(username, slug, tz);
    try {
      const from = new Date();
      const to = new Date(Date.now() + AHEAD * DAY_MS);
      // No answer at all left "Loading times" up for good: past
      // 8 seconds the fallback takes over, as for any other failure.
      const signal = AbortSignal.timeout?.(8000);
      const kept = fresh ? undefined : peek(key);
      // The event and its times in one (`app/api/slots`); a failed answer is a failure like no answer.
      const got = kept ?? getJson<SlotsAnswer>(`/api/slots?slug=${slug}&start=${localDayKey(from)}&end=${localDayKey(to)}&timeZone=${encodeURIComponent(tz)}${fresh ? "&fresh" : ""}`, { signal })
        .then((r) => {
          if (!r.ok) throw new Error(r.error ?? "no times");
          return r.data;
        });
      if (got !== kept) recent.set(key, { at: Date.now(), got });
      const slots = await got;
      // An answer with no times (or no body) is a failure too.
      if (!slots?.slots) throw new Error("no times");
      // A paid event's deposit is taken here (deposit-step.tsx) where the
      // build has Stripe's key; without it, the fallback.
      // Paid by the site's list (lib/booking/paid.ts).
      const owes = takesDeposit(slug);
      if (owes && !process.env.NEXT_PUBLIC_STRIPE_PK) {
        setState("fallback");
        return;
      }
      setPaid(owes);
      setLength(slots.length);
      setSession(slots.title);
      setNeedsWhere(slots.where);
      setDays(slots.slots);
      setState("ready");
    } catch {
      recent.delete(key);
      // Only before the times have come. A reload after a booking failed
      // keeps the times it had, and the form with what was typed in it.
      setState((s) => (s === "ready" ? s : "fallback"));
    }
  }, [username, slug, tz]);

  return { length, setLength, needsWhere, setNeedsWhere, session, setSession, days, setDays, state, setState, paid, setPaid, load };
}
