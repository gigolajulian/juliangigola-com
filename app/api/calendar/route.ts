import { getCloudflareContext } from "@opennextjs/cloudflare";
import { TZ } from "@/lib/time-zone";
import { gcal } from "@/lib/google";
import { looksLikeEmail } from "@/lib/utils";
import { busyAll, EXTRA_KEY, isIcs, readExtras, instantIn, type Extra } from "@/lib/booking/slots";
import { refuseAdmin } from "@/lib/vouch";
import { bodyOf, json, statusOf, upstreamError } from "@/lib/http";

/* ── the Leads app's Calendar ─────────────────────────────────────
 * Controls the calendar: blocks off days and adds
 * other calendars to read. GET shows a range of hello@'s calendar
 * plus the busy time of the extra calendars; POST blocks or unblocks time
 * and adds or drops an extra calendar.
 *
 * A block is an event on hello@ ("Blocked", marked `jgBlock`), so the
 * site's engine stops offering it at once, and it shows in
 * Google Calendar too. Only events with that mark can be unblocked here:
 * this route never deletes a booking. Extras live in INBOX (`lib/booking/slots.ts`).
 * The /admin gate: the admin key or a GitHub token that can push.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_EXTRAS = 10;

async function calendarGate(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  // Who is asking first: what this build is missing is for /admin only.
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return { error: denied };
  if (!env.INBOX) return { error: json({ error: "No INBOX bound." }, 503) };
  if (!env.GCAL_OAUTH) return { error: json({ error: "The calendar is not connected (GCAL_OAUTH)." }, 503) };
  return { env };
}

type GEvent = {
  id: string;
  summary?: string;
  transparency?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: { jgBlock?: string; jgBooking?: string } };
};

/** An all-day date as the instant it starts in Julian's zone. */
const at = (t: { date?: string; dateTime?: string }) => {
  if (t.dateTime) return new Date(t.dateTime).toISOString();
  const [y, m, d] = t.date!.split("-").map(Number);
  return new Date(instantIn(y, m, d, 0)).toISOString();
};
/** What the app shows of a source: a Google id in full, an ICS link by its host only, since the link is the password. */
const shown = (src: string) => (isIcs(src) ? new URL(src.replace(/^webcal:/i, "https:")).host : src);
const dayMs = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return instantIn(y, m, d, 0);
};

export async function GET(request: Request) {
  const g = await calendarGate(request);
  if (g.error) return g.error;
  const q = new URL(request.url).searchParams;
  const [from, to] = [q.get("from") ?? "", q.get("to") ?? ""];
  if (!DAY.test(from) || !DAY.test(to) || to < from) return json({ error: "Bad range." }, 400);
  const a = dayMs(from);
  const b = Math.min(dayMs(to) + 864e5, a + 62 * 864e5);
  const extras = await readExtras(g.env.INBOX);
  try {
    const [list, { busy, failed }] = await Promise.all([
      gcal<{ items?: GEvent[] }>(
        g.env.GCAL_OAUTH,
        `/calendars/primary/events?${new URLSearchParams({ timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" })}`,
      ),
      busyAll(g.env.GCAL_OAUTH, a, b, extras),
    ]);
    return json({
      events: (list.items ?? []).map((e) => ({
        id: e.id,
        title: e.summary ?? "(busy)",
        start: at(e.start),
        end: at(e.end),
        allDay: !!e.start.date,
        block: !!e.extendedProperties?.private?.jgBlock,
        booking: !!e.extendedProperties?.private?.jgBooking,
        free: e.transparency === "transparent",
      })),
      busy: busy.filter((x) => x.label).map((x) => ({ label: x.label, start: new Date(x.start).toISOString(), end: new Date(x.end).toISOString() })),
      extras: extras.map((x) => ({ label: x.label, src: shown(x.src), ics: isIcs(x.src), failed: failed.includes(x.label) })),
    });
  } catch (e) {
    return upstreamError("calendar", e, "Could not reach the calendar.");
  }
}

type Body = {
  block?: { from?: string; to?: string; start?: string; end?: string; note?: string };
  unblock?: string;
  extra?: { label?: string; src?: string };
  drop?: string;
};

async function post(request: Request) {
  const g = await calendarGate(request);
  if (g.error) return g.error;
  const body = (await bodyOf(request)) as Body | null;
  if (!body) return json({ error: "Bad request." }, 400);
  const { env } = g;

  if (body.block) {
    const { from = "", to = from, start, end, note } = body.block;
    if (!DAY.test(from) || !DAY.test(to) || to < from) return json({ error: "Pick the days." }, 400);
    const timed = start !== undefined || end !== undefined;
    if (timed && (from !== to || !TIME.test(start ?? "") || !TIME.test(end ?? "") || end! <= start!)) return json({ error: "A time block is one day, start before end." }, 400);
    const next = new Date(Date.parse(`${to}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
    const ev = await gcal<GEvent>(env.GCAL_OAUTH, "/calendars/primary/events?sendUpdates=none", {
      body: {
        summary: note ? `Blocked: ${String(note).slice(0, 80)}` : "Blocked",
        // Opaque even all day: Google's free/busy counts it as busy, so no time is offered.
        transparency: "opaque",
        start: timed ? { dateTime: `${from}T${start}:00`, timeZone: TZ } : { date: from },
        end: timed ? { dateTime: `${from}T${end}:00`, timeZone: TZ } : { date: next },
        extendedProperties: { private: { jgBlock: "1" } },
      },
    });
    return json({ ok: true, id: ev.id });
  }

  if (typeof body.unblock === "string") {
    const path = `/calendars/primary/events/${encodeURIComponent(body.unblock)}`;
    // Only a missing event is "not a block"; a calendar that is down answers 502 like every other call here.
    const ev = await gcal<GEvent>(env.GCAL_OAUTH, path).catch((e: unknown) => {
      const status = statusOf(e);
      if (status === 404 || status === 410) return null;
      throw e;
    });
    // Only a block made here: a booking or anything else on hello@ stays.
    if (!ev?.extendedProperties?.private?.jgBlock) return json({ error: "Not a block." }, 400);
    await gcal(env.GCAL_OAUTH, `${path}?sendUpdates=none`, { method: "DELETE" });
    return json({ ok: true });
  }

  if (body.extra) {
    const label = String(body.extra.label ?? "").trim().slice(0, 40);
    const src = String(body.extra.src ?? "").trim();
    let ok = looksLikeEmail(src);
    if (isIcs(src)) {
      try {
        ok = new URL(src.replace(/^webcal:/i, "https:")).protocol === "https:";
      } catch {
        ok = false;
      }
    }
    if (!label || !ok) return json({ error: "A name, and a Google calendar id or an ICS link." }, 400);
    const extras = await readExtras(env.INBOX);
    if (extras.some((x) => x.label === label)) return json({ error: "That name is taken." }, 400);
    if (extras.length >= MAX_EXTRAS) return json({ error: `${MAX_EXTRAS} calendars at most.` }, 400);
    await env.INBOX.put(EXTRA_KEY, JSON.stringify([...extras, { label, src } satisfies Extra]));
    return json({ ok: true });
  }

  if (typeof body.drop === "string") {
    const extras = await readExtras(env.INBOX);
    await env.INBOX.put(EXTRA_KEY, JSON.stringify(extras.filter((x) => x.label !== body.drop)));
    return json({ ok: true });
  }

  return json({ error: "Bad request." }, 400);
}

export async function POST(request: Request) {
  try {
    return await post(request);
  } catch (e) {
    return upstreamError("calendar", e, "Could not reach the calendar.");
  }
}
