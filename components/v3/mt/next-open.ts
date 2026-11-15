"use client";

import * as React from "react";
import { SESSIONS, type SessionSlug } from "@/lib/v3";

/* "Next open" (spec 3.4): the first open slot from the same engine /book
   reads (`app/api/slots`). Nothing on failure, slowness or no slots: the
   line then shows only its turnaround. One request per session per visit. */
const seen = new Map<string, Promise<string | null>>();
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const nextOpenLabel = (start: string, tz?: string) =>
  new Date(start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz }).replace(",", "");

function lookup(slug: SessionSlug) {
  const ev = SESSIONS[slug].cal?.split("/")[1];
  if (!ev) return Promise.resolve(null);
  if (!seen.has(ev)) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const p = fetch(`/api/slots?slug=${ev}&start=${ymd(now)}&end=${ymd(new Date(+now + 60 * 864e5))}&timeZone=${encodeURIComponent(tz)}`, { signal: AbortSignal.timeout?.(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { status?: string; data?: Record<string, { start: string }[]> } | null) => {
        if (j?.status !== "success" || !j.data) return null;
        const day = Object.keys(j.data).filter((d) => j.data![d]?.length).sort()[0];
        return day ? nextOpenLabel(j.data[day][0].start, tz) : null;
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
