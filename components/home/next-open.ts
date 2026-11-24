"use client";

import * as React from "react";
import { SESSIONS, type SessionSlug } from "@/lib/booking/catalog";
import { byCodeUnit } from "@/lib/utils";
import { getJson } from "@/lib/http";
import { DAY_MS, TZ } from "@/lib/time-zone";

/* "Next open" (spec 3.4): the first open slot from the same engine /book
   reads (`app/api/slots`). Nothing on failure, slowness or no slots: the
   line is left out. One request per session per visit. */
const seen = new Map<string, Promise<string | null>>();
/** A day as "2026-11-04" in the zone `tz`. */
const dayIn = (tz: string, t: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(t);
/** The window asked for: 60 days from today in Julian's time, or the visitor's own today when
    that is earlier, since the engine files each slot under the visitor's day. Never the UTC
    day, which is tomorrow from late afternoon in Pacific time. */
export function slotWindow(tz: string, now = new Date()) {
  const start = [dayIn(TZ, now), dayIn(tz, now)].sort(byCodeUnit)[0];
  return { start, end: new Date(Date.parse(`${start}T12:00:00Z`) + 60 * DAY_MS).toISOString().slice(0, 10) };
}

export const nextOpenLabel = (start: string, tz?: string) =>
  new Date(start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz }).replace(",", "");

function lookup(slug: SessionSlug) {
  const ev = SESSIONS[slug].cal?.split("/")[1];
  if (!ev) return Promise.resolve(null);
  if (!seen.has(ev)) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const q = new URLSearchParams({ slug: ev, ...slotWindow(tz), timeZone: tz });
    const p = getJson<{ slots?: Record<string, string[]> } | null>(`/api/slots?${q}`, { signal: AbortSignal.timeout?.(5000) })
      .then((r) => {
        const slots = r.ok ? r.data?.slots : undefined;
        if (!slots) return null;
        const day = Object.keys(slots).filter((d) => slots[d]?.length).sort(byCodeUnit)[0];
        return day ? nextOpenLabel(slots[day][0], tz) : null;
      })
      .catch(() => null);
    seen.set(ev, p);
  }
  return seen.get(ev)!;
}

export function useNextOpen(slug: SessionSlug | null) {
  const [got, setGot] = React.useState<Record<string, string | null>>({});
  React.useEffect(() => {
    if (!slug || slug in got) return;
    let live = true;
    void lookup(slug).then((v) => live && setGot((g) => ({ ...g, [slug]: v })));
    return () => {
      live = false;
    };
  }, [slug, got]);
  return slug ? (got[slug] ?? null) : null;
}
