import { getCloudflareContext } from "@opennextjs/cloudflare";
import { liveHours } from "@/lib/booking-engine";
import { EVENTS } from "@/lib/booking-rules";
import { localIso, openStarts } from "@/lib/slots";
import { TZ } from "@/lib/booking-rules";
import { json } from "@/lib/http";

/* ── open times for the picker, from the site's own engine ────────
 * GET /api/slots?slug=portraits&start=2026-11-04&end=2027-03-04&timeZone=...
 * Answers in Cal.com's shape (`/v2/slots?format=range` plus the event), so
 * `components/booking/time-picker.tsx` reads either engine the same way. Starts are
 * written in the visitor's zone and grouped by their day there. See
 * `lib/slots.ts`. Off (503) until GCAL_OAUTH is set.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GCAL_OAUTH) return json({ status: "error", error: { message: "Not set up." } }, 503);

  const q = new URL(request.url).searchParams;
  const slug = q.get("slug") ?? "";
  const rule = EVENTS[slug];
  const tz = q.get("timeZone") || TZ;
  const [start, end] = [q.get("start") ?? "", q.get("end") ?? ""];
  if (!rule) return json({ status: "error", error: { message: "Unknown session." } }, 400);
  if (!DAY.test(start) || !DAY.test(end)) return json({ status: "error", error: { message: "Bad range." } }, 400);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return json({ status: "error", error: { message: "Unknown time zone." } }, 400);
  }
  // The visitor's days, widened by a day each side for any zone; capped at 130 days.
  const from = Date.parse(`${start}T00:00:00Z`) - 864e5;
  const to = Math.min(Date.parse(`${end}T00:00:00Z`) + 2 * 864e5, from + 130 * 864e5);

  let starts: number[];
  try {
    starts = await openStarts(env.GCAL_OAUTH, slug, from, to, { kv: env.INBOX, hours: await liveHours(env) });
  } catch (e) {
    console.error("slots", String(e));
    return json({ status: "error", error: { message: "Could not reach the calendar." } }, 502);
  }
  const data: { [day: string]: { start: string; end: string }[] } = {};
  for (const s of starts) {
    const at = localIso(s, tz);
    const day = at.slice(0, 10);
    if (day < start || day > end) continue;
    (data[day] ??= []).push({ start: at, end: localIso(s + rule.length * 6e4, tz) });
  }
  return json({
    status: "success",
    event: {
      title: rule.title,
      lengthInMinutes: rule.length,
      price: 0,
      locations: [{ type: rule.call ? "integration" : "attendeeDefined" }],
    },
    data,
  });
}
