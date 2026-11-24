import { getCloudflareContext } from "@opennextjs/cloudflare";
import { liveHours } from "@/lib/booking/engine";
import { EVENTS } from "@/lib/booking/rules";
import { localIso, openStarts, type SlotsAnswer } from "@/lib/booking/slots";
import { TZ, DAY_MS } from "@/lib/time-zone";
import { json, upstreamError } from "@/lib/http";

/* ── open times for the picker, from the site's own engine ────────
 * GET /api/slots?slug=portraits&start=2026-11-04&end=2027-03-04&timeZone=...
 * Answers { title, length, where, slots: { day: [start] } } (`SlotsAnswer`),
 * which `components/booking/picker/use-picker.tsx` reads; a failure is { error }. Starts are
 * written in the visitor's zone and grouped by their day there. See
 * `lib/booking/slots.ts`. Off (503) until GCAL_OAUTH is set.
 * An answer is kept a minute in the colo's cache, so the picker does not
 * wait on Google's free/busy every time (0.5 to 2.3s on a phone, the
 * booking wait). Safe: a time is checked again before a deposit or a
 * booking moves (`openNow`). `&fresh` skips it, after a time was taken.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEEP_S = 60;
const edge = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GCAL_OAUTH) return json({ error: "Not set up." }, 503);

  const q = new URL(request.url).searchParams;
  const slug = q.get("slug") ?? "";
  const rule = EVENTS[slug];
  const tz = q.get("timeZone") || TZ;
  const [start, end] = [q.get("start") ?? "", q.get("end") ?? ""];
  if (!rule) return json({ error: "Unknown session." }, 400);
  if (!DAY.test(start) || !DAY.test(end)) return json({ error: "Bad range." }, 400);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return json({ error: "Unknown time zone." }, 400);
  }
  const cache = edge();
  const key = new Request(`https://slots-cache.invalid/v2/${slug}/${start}/${end}/${encodeURIComponent(tz)}`);
  const kept = cache && !q.has("fresh") ? await cache.match(key).catch(() => undefined) : undefined;
  if (kept) return json(await kept.json());
  // The visitor's days, widened by a day each side for any zone; capped at 130 days.
  const from = Date.parse(`${start}T00:00:00Z`) - DAY_MS;
  const to = Math.min(Date.parse(`${end}T00:00:00Z`) + 2 * DAY_MS, from + 130 * DAY_MS);

  let starts: number[];
  try {
    starts = await openStarts(env.GCAL_OAUTH, slug, from, to, { kv: env.INBOX, hours: await liveHours(env) });
  } catch (e) {
    return upstreamError("slots", e, "Could not reach the calendar.");
  }
  const slots: SlotsAnswer["slots"] = {};
  for (const s of starts) {
    const at = localIso(s, tz);
    const day = at.slice(0, 10);
    if (day < start || day > end) continue;
    (slots[day] ??= []).push(at);
  }
  const answer: SlotsAnswer = { title: rule.title, length: rule.length, where: !rule.call, slots };
  await cache?.put(key, Response.json(answer, { headers: { "cache-control": `max-age=${KEEP_S}` } })).catch(() => {});
  return json(answer);
}
