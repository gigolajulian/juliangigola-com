"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ── the dense time picker ────────────────────────────────────────
 * The booking card redrawn tight (Julian, 2026-10-15: "way too spaced
 * out", the errors, the check mark, the steps' transitions). Behind
 * `?dense` while it is tried (`cal-embed.tsx`); the live one is
 * `time-picker.tsx`, whose Cal.com reading and booking this repeats.
 *
 * One frame for every step: a head line, the body, and a bar at the foot
 * that holds the session, the time and the one action. Days and times are
 * ruled cells sharing hairlines. Errors sit in their row. Booking runs a
 * hairline along the bar, which becomes the rule under "you're in."
 * ─────────────────────────────────────────────────────────────── */

const API = "https://api.cal.com/v2";
const KEEP = 60_000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recent = new Map<string, { at: number; got: Promise<[any, any]> }>();
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PARTS = [["Morning", 0, 720], ["Afternoon", 720, 1020], ["Evening", 1020, 1440]] as const;
const AHEAD = 120;
const WHERE: Record<string, [label: string, ask?: string][]> = {
  graduation: [["On campus", "Which campus?"], ["In studio"]],
  portraits: [["Studio"], ["Outdoor", "Where?"], ["Your location", "Where?"]],
  headshots: [["Studio"], ["On location", "Address"]],
  digitals: [["Studio"]],
};

type Slot = { start: string; end: string };
type Pick = { date: string; min: number; start: string };
type Step = "pick" | "form" | "sending" | "done";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const minutesOf = (start: string) => +start.slice(11, 13) * 60 + +start.slice(14, 16);
const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${pad(m % 60)}`;
const ampm = (m: number) => (Math.floor(m / 60) % 24 < 12 ? "AM" : "PM");
const zone = (start: string, tz: string) =>
  tz === "America/Los_Angeles"
    ? "Pacific"
    : new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(start)).find((p) => p.type === "timeZoneName")?.value ?? tz;
const e164 = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return "";
};

const arrow = (dir: 1 | -1) => (
  <svg aria-hidden viewBox="0 0 22 16" className={cn("h-3.5 w-5", dir > 0 && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
    <path d="M20.5 8H2.5M6.5 5 2.5 8 6.5 11" />
  </svg>
);

/** A row of the details: the label to the left, the field, its error in the row. */
function Row({ label, error, children, last, id }: { label: string; error?: string; children: React.ReactNode; last?: boolean; id?: string }) {
  return (
    <div data-err={error ? "" : undefined} className={cn("tpd-row grid grid-cols-1 items-center gap-1.5 px-4 py-3 @lg:grid-cols-[7.5rem_minmax(0,1fr)] @lg:gap-4 @lg:px-5 @lg:py-0 @lg:min-h-[3.125rem]", !last && "border-b border-border")}>
      <span className="label text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-col gap-1 @lg:flex-row @lg:items-center @lg:gap-4">
        {children}
        {error ? <span id={id && `tpd-${id}-err`} className="tpd-msg text-[0.6875rem] tracking-[0.04em] @lg:ml-auto @lg:shrink-0">{error}</span> : null}
      </div>
    </div>
  );
}

const field = "w-full min-w-0 bg-transparent py-1 text-base @lg:text-sm normal-case text-foreground outline-none placeholder:text-muted-foreground/45";

export function DenseTimePicker({ path, title, className, fallback }: { path: string; title: string; className?: string; fallback: React.ReactNode }) {
  const [username, slug] = path.split("/");
  const [tz] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles");
  const [needsWhere, setNeedsWhere] = React.useState(false);
  const [session, setSession] = React.useState("");
  /** A call (Google Meet, from Cal.com): its times by the hour, and no place to ask. */
  const [call, setCall] = React.useState("");
  const [days, setDays] = React.useState<Record<string, Slot[]> | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "fallback">("loading");
  const [view, setView] = React.useState<"week" | "month">("week");
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [slide, setSlide] = React.useState(0);
  const [pick, setPick] = React.useState<Pick | null>(null);
  const [timed, setTimed] = React.useState(false);
  const [step, setStep] = React.useState<Step>("pick");
  /** Which way the body last moved: 1 on to the details, -1 back. */
  const [dir, setDir] = React.useState(1);
  const [opt, setOpt] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [fail, setFail] = React.useState("");
  const [booked, setBooked] = React.useState({ name: "", email: "", where: "" });
  const formRef = React.useRef<HTMLFormElement>(null);
  const swipe = React.useRef<{ x: number; y: number; done: boolean } | null>(null);

  const load = React.useCallback(async (fresh = false) => {
    const key = `${username}/${slug}/${tz}`;
    try {
      const from = new Date();
      const to = new Date(Date.now() + AHEAD * 864e5);
      const signal = AbortSignal.timeout?.(8000);
      const hit = recent.get(key);
      const got = !fresh && hit && Date.now() - hit.at < KEEP ? hit.got : Promise.all([
        fetch(`${API}/event-types?username=${username}&eventSlug=${slug}`, { headers: { "cal-api-version": "2024-06-14" }, signal }).then((r) => r.json()),
        fetch(`${API}/slots?username=${username}&eventTypeSlug=${slug}&start=${iso(from)}&end=${iso(to)}&timeZone=${encodeURIComponent(tz)}&format=range`, { headers: { "cal-api-version": "2024-09-04" }, signal }).then((r) => r.json()),
      ]);
      if (got !== hit?.got) recent.set(key, { at: Date.now(), got });
      const [meta, slots] = await got;
      const ev = Array.isArray(meta.data) ? meta.data[0] : meta.data;
      if (!ev || slots.status !== "success") throw new Error("no times");
      if ((ev.price ?? 0) > 0 || ev.requiresConfirmation) return setState("fallback");
      setSession(ev.title || "");
      const meet = Array.isArray(ev.locations) ? ev.locations.find((l: { type: string }) => l.type === "integration") : null;
      setCall(meet ? String(meet.integration || "video").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "");
      setNeedsWhere(Array.isArray(ev.locations) && ev.locations.some((l: { type: string }) => l.type === "attendeeDefined"));
      setDays(slots.data);
      setState("ready");
    } catch {
      recent.delete(key);
      setState((s) => (s === "ready" ? s : "fallback"));
    }
  }, [username, slug, tz]);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /* The first open day, picked; its time is the visitor's to pick. */
  React.useEffect(() => {
    if (state !== "ready" || !days || pick) return;
    const date = Object.keys(days).filter((d) => days[d].length).sort()[0];
    if (!date) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPick({ date, min: minutesOf(days[date][0].start), start: days[date][0].start });
    setAnchor(fromIso(date));
  }, [state, days, pick]);
  /* The time picked went (taken while the details were typed): pick again. */
  React.useEffect(() => {
    if (pick && timed && days && !days[pick.date]?.some((x) => x.start === pick.start)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimed(false);
    }
  }, [days, pick, timed]);

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const week = React.useMemo(() => {
    const d = new Date(Math.max(+anchor, +today));
    d.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
  }, [anchor, today]);
  const month = React.useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  }, [anchor]);
  const atStart = view === "week" ? +week[0] <= +today : anchor.getFullYear() * 12 + anchor.getMonth() <= today.getFullYear() * 12 + today.getMonth();
  const shift = (d: number) => {
    setSlide(d);
    const x = new Date(view === "week" ? week[0] : anchor);
    if (view === "week") x.setDate(x.getDate() + 7 * d);
    else x.setMonth(x.getMonth() + d, 1);
    setAnchor(x);
  };
  const switchView = (v: "week" | "month") => {
    if (v === view) return;
    setSlide(0);
    if (v === "week" && pick && fromIso(pick.date).getMonth() === anchor.getMonth()) setAnchor(fromIso(pick.date));
    setView(v);
  };
  const chooseDay = (date: string) => {
    const list = days?.[date];
    if (!list?.length) return;
    const same = timed && pick ? list.find((x) => minutesOf(x.start) === pick.min) : undefined;
    const s = same ?? list[0];
    setTimed(!!same);
    setPick({ date, min: minutesOf(s.start), start: s.start });
  };
  const chooseTime = (s: Slot) => {
    setTimed(true);
    setPick({ date: s.start.slice(0, 10), min: minutesOf(s.start), start: s.start });
  };
  const go = (to: Step, d: number) => {
    setDir(d);
    setStep(to);
  };

  const book = async (form: HTMLFormElement) => {
    // Book it stays pressable while it sends: a second press is not a second booking.
    if (!pick || step === "sending") return;
    const f = new FormData(form);
    const val = (k: string) => String(f.get(k) ?? "").trim();
    const opts = WHERE[slug];
    const chosen = opts?.length === 1 ? opts[0][0] : val("opt");
    const asked = opts?.find(([l]) => l === chosen)?.[1];
    /* Checked here, said in the row (Julian: no browser bubble). */
    const bad: Record<string, string> = {};
    if (!val("first") || !val("last")) bad.name = "Add your first and last name";
    if (!/^\S+@\S+\.\S+$/.test(val("email"))) bad.email = val("email") ? "That email looks off" : "Add an email for the confirmation";
    const phone = e164(val("phone"));
    if (!phone) bad.phone = val("phone") ? "Add the country code if it is not a US number" : "Add a number I can text on the day";
    if (needsWhere && opts && opts.length > 1 && !chosen) bad.where = "Pick one";
    else if (needsWhere && asked && !val("detail")) bad.where = asked.replace(/\?$/, "") + ", please";
    else if (needsWhere && !opts && !val("where")) bad.where = "The studio, or an address";
    setErrors(bad);
    setFail("");
    const first = Object.keys(bad)[0];
    if (first) {
      form.querySelector<HTMLElement>(`[data-f="${first}"] input:not([type=radio]), [data-f="${first}"] input`)?.focus();
      return;
    }
    const where = opts ? [chosen, asked ? val("detail") : ""].filter(Boolean).join(": ") : val("where");
    setStep("sending");
    const began = Date.now();
    try {
      const res = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
        body: JSON.stringify({
          start: new Date(pick.start).toISOString(),
          eventTypeSlug: slug,
          username,
          attendee: { name: `${val("first")} ${val("last")}`, email: val("email"), phoneNumber: phone, timeZone: tz, language: "en" },
          ...(needsWhere ? { location: { type: "attendeeDefined", location: where } } : {}),
          bookingFieldsResponses: { notes: [`Phone: ${phone}`, val("notes")].filter(Boolean).join("\n") },
        }),
      });
      const body = await res.json();
      if (!res.ok || body.status !== "success") throw new Error(body?.error?.message || "failed");
      setBooked({ name: val("first"), email: val("email"), where });
      // The line runs at least most of the bar, so a quick answer still reads as sent.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - began))));
      recent.delete(`${username}/${slug}/${tz}`);
      go("done", 1);
    } catch (e) {
      setFail(/(already|not available|busy|booked)/i.test(String(e)) ? "That time was just taken. Pick another." : "That did not go through. Try again.");
      setStep("form");
      void load(true);
    }
  };

  if (state === "fallback") return <>{fallback}</>;

  /* Loading, or a session switched: the frame stands, its cells empty. */
  if (state === "loading" || !days) {
    return (
      <div aria-label={title} aria-busy className={cn("tpd @container !flex min-h-[26rem] flex-col", className)}>
        <div className="flex h-11 shrink-0 items-center border-b border-border px-4 @lg:px-5"><span className="label text-muted-foreground">01 Day</span></div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="tpd-cell flex h-[4.5rem] flex-col gap-2 p-2.5 @lg:p-3"><i className="tpd-sk h-2 w-6" /><i className="tpd-sk h-5 w-7" /></span>
          ))}
        </div>
        <div className="tpd-grid m-4 @lg:mx-5">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className="tpd-cell h-10" />)}
        </div>
        <Bar>
          <span className="label text-muted-foreground" role="status">Checking times</span>
        </Bar>
      </div>
    );
  }
  if (!pick) {
    return (
      <div aria-label={title} className={cn("flex flex-col items-center justify-center gap-4 p-6 text-center", className)}>
        <p className="label text-muted-foreground">No open times in the next few months.</p>
        <a href="mailto:hello@juliangigola.com" className="label border-b border-border">hello@juliangigola.com</a>
      </div>
    );
  }

  const date = fromIso(pick.date);
  const name = session || title;
  const dayName = `${DAYS[date.getDay()]} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  const when = `${dayName} · ${clock(pick.min)} ${ampm(pick.min)}${tz === "America/Los_Angeles" ? "" : ` ${zone(pick.start, tz)}`}`;

  if (step === "done") {
    const first = booked.name.split(/\s+/)[0];
    const rows: [string, string][] = [
      [call ? "Call" : "Session", name],
      ["When", `${dayName}, ${clock(pick.min)} ${ampm(pick.min)}`],
      ...(call ? ([["On", call]] as [string, string][]) : booked.where ? ([["Where", booked.where]] as [string, string][]) : []),
      ["Sent to", booked.email],
    ];
    return (
      <div aria-label={title} role="status" className={cn("tpd @container !flex flex-col", className)}>
        <div className="px-4 pt-6 @lg:px-5 @lg:pt-7">
          <p className="label tp-roll text-muted-foreground">Booked</p>
          <h3 className="tp-roll mt-3 font-display text-[clamp(2.5rem,11cqw,4.5rem)] uppercase leading-[0.9] tracking-[-0.04em] [text-wrap:balance]" style={{ animationDelay: "120ms" }}>
            {first ? `${first}, you’re in.` : "You’re in."}
          </h3>
          {/* The bar's line, finished: the rule under the name. */}
          <div aria-hidden className="tpd-rule mt-5 h-px bg-foreground" />
        </div>
        <dl className="mx-4 grid grid-cols-2 border-b border-border @lg:mx-5 @2xl:grid-cols-4">
          {rows.map(([k, v], n) => (
            <div key={k} className="tpd-spec tp-roll flex min-w-0 flex-col gap-1.5 py-3" style={{ animationDelay: `${380 + n * 60}ms` }}>
              <dt className="label text-muted-foreground">{k}</dt>
              <dd className="break-words text-sm normal-case">{v}</dd>
            </div>
          ))}
        </dl>
        <ol className="tp-roll grid gap-4 px-4 py-5 text-xs normal-case leading-[1.7] text-muted-foreground @lg:px-5 @2xl:grid-cols-2 @2xl:gap-6" style={{ animationDelay: "640ms" }}>
          <li className="flex gap-3"><b className="w-6 shrink-0 tabular-nums font-medium text-foreground">01</b>{call ? `The confirmation and the ${call} link are in your inbox now.` : "The confirmation is in your inbox now."}</li>
          <li className="flex gap-3"><b className="w-6 shrink-0 tabular-nums font-medium text-foreground">02</b>Need another time? The email has a link to move or cancel it.</li>
        </ol>
        <Bar>
          <span className="label truncate text-muted-foreground">{call ? "Talk to you then." : <>I&rsquo;ll be in touch before the day.</>}</span>
          <Link prefetch={false} href="/portfolio" className="tpd-act tpd-quiet">See the work {arrow(1)}</Link>
        </Bar>
      </div>
    );
  }

  const head = (left: React.ReactNode, right: React.ReactNode) => (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4 @lg:px-5">
      {left}
      {right}
    </div>
  );

  const times = (list: Slot[]) => {
    const kinds = PARTS.map(([part, from, to]) => [part, list.filter((x) => minutesOf(x.start) >= from && minutesOf(x.start) < to)] as const).filter(([, l]) => l.length);
    return kinds.map(([part, l]) => (
      <div key={part} className="contents">
        <span className="label pt-1 text-muted-foreground @lg:pt-3">{part}</span>
        <div className="tpd-grid">
          {l.map((s) => {
            const on = timed && s.start === pick.start;
            return (
              <button key={s.start} type="button" aria-pressed={on} aria-label={`${clock(minutesOf(s.start))} ${ampm(minutesOf(s.start))}`} onClick={() => chooseTime(s)} className={cn("tpd-cell tpd-pick h-11 @lg:h-10 text-[0.8125rem] font-medium tabular-nums", on && "tpd-on")}>
                {clock(minutesOf(s.start))}
              </button>
            );
          })}
        </div>
      </div>
    ));
  };
  /* A call's times by the hour, a row an hour and a column a quarter (or
     whatever the length makes of one): a day of sixteen calls in four
     rows, and a taken time a gap where it would be. */
  const hours = (list: Slot[]) => {
    // The columns are the minutes the times start on, across every day
    // (Cal.com offers a 15-minute call on the half hour: two, not four).
    const cols = [...new Set(Object.values(days).flat().map((x) => minutesOf(x.start) % 60))].sort((a, b) => a - b);
    const per = cols.length;
    if (per > 4) return null;
    const rows = [...new Set(list.map((x) => Math.floor(minutesOf(x.start) / 60)))];
    return (
      <div className="flex gap-3">
        <div className="flex flex-col pt-px">
          {rows.map((h) => <span key={h} className="label -mt-px flex h-11 @lg:h-10 w-11 shrink-0 items-center text-muted-foreground">{clock(h * 60).replace(":00", "")} {ampm(h * 60)}</span>)}
        </div>
        <div className="tpd-grid" style={{ width: `calc(${per} * var(--tw, 4.5rem) + 1px)` }}>
          {rows.flatMap((h) =>
            Array.from({ length: per }, (_, i) => {
              const m = h * 60 + cols[i];
              const s = list.find((x) => minutesOf(x.start) === m);
              if (!s) return <span key={m} aria-hidden className="tpd-cell h-11 @lg:h-10" />;
              const on = timed && s.start === pick.start;
              return <button key={m} type="button" aria-pressed={on} aria-label={`${clock(m)} ${ampm(m)}`} onClick={() => chooseTime(s)} className={cn("tpd-cell tpd-pick h-11 @lg:h-10 text-[0.8125rem] font-medium tabular-nums", on && "tpd-on")}>{clock(m)}</button>;
            }),
          )}
        </div>
      </div>
    );
  };
  const dayList = days[pick.date] ?? [];

  const picker = (
    <>
      {head(
        <div className="label flex items-center gap-1 whitespace-nowrap">
          <span className="mr-2 text-muted-foreground @max-md:hidden">01 Day</span>
          <button type="button" aria-label="Earlier" disabled={atStart} onClick={() => shift(-1)} className="tap-44 flex h-8 items-center px-1 transition-opacity hoverable:hover:opacity-60 disabled:opacity-25">{arrow(-1)}</button>
          <span className="grid text-center">
            <span aria-hidden className="invisible [grid-area:1/1]">Sep 22 to Sep 28</span>
            <span className="[grid-area:1/1]">{view === "week" ? `${MONTHS[week[0].getMonth()].slice(0, 3)} ${week[0].getDate()} to ${week[6].getMonth() === week[0].getMonth() ? "" : MONTHS[week[6].getMonth()].slice(0, 3) + " "}${week[6].getDate()}` : MONTHS[anchor.getMonth()]}</span>
          </span>
          <button type="button" aria-label="Later" onClick={() => shift(1)} className="tap-44 flex h-8 items-center px-1 transition-opacity hoverable:hover:opacity-60">{arrow(1)}</button>
        </div>,
        <div className="label flex gap-3.5">
          {(["week", "month"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)} className={cn("tap-44 pb-0.5 transition-colors", view === v ? "shadow-[inset_0_-1px_0_currentColor]" : "text-muted-foreground hoverable:hover:text-foreground")}>{v}</button>
          ))}
        </div>,
      )}
      <div
        key={`${view}${iso(view === "week" ? week[0] : anchor)}`}
        data-slide={slide}
        className={cn("touch-pan-y", view === "month" && "grid min-h-0 flex-1 @2xl:grid-cols-[minmax(0,1fr)_17rem]", slide && "tpd-slide")}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, done: false };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return void (swipe.current = null);
          s.done = true;
          if (dx < 0) shift(1);
          else if (!atStart) shift(-1);
        }}
        onClickCapture={(e) => {
          if (swipe.current?.done) e.stopPropagation();
          swipe.current = null;
        }}
      >
        {view === "week" ? (
          <div className="grid grid-cols-7">
            {week.map((d) => {
              const id = iso(d);
              const n = days[id]?.length ?? 0;
              const on = pick.date === id;
              return (
                <button key={id} type="button" disabled={!n} aria-pressed={on} onClick={() => chooseDay(id)} aria-label={`${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}, ${n ? `${n} open` : "closed"}`} className={cn("tpd-cell tpd-pick flex min-h-[4.5rem] min-w-0 flex-col items-start gap-1 p-2 text-left @lg:p-3", on && "tpd-on", !n && "text-muted-foreground/45")}>
                  <span className="label">{DAYS[d.getDay()]}</span>
                  <b className="font-display text-[clamp(1.125rem,4.5cqw,1.625rem)] leading-none tracking-[-0.03em]">{d.getDate()}</b>
                  <span className={cn("label mt-auto truncate", n && !on && "text-accent")}>{n ? <>{n}<span className="max-[24rem]:hidden @max-md:hidden"> open</span></> : <span className="@max-md:hidden">Closed</span>}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-0 grid-cols-7 grid-rows-[1.625rem] auto-rows-[minmax(2.5rem,1fr)] @max-2xl:border-b @max-2xl:border-border">
            {DAYS.map((d, i) => <span key={i} className="tpd-cell label px-2 pt-1.5 text-muted-foreground">{d[0]}</span>)}
            {month.map((d, i) => {
              if (!d) return <span key={`b${i}`} className="tpd-cell" />;
              const id = iso(d);
              const n = days[id]?.length ?? 0;
              const on = pick.date === id;
              return (
                <button key={id} type="button" disabled={!n} aria-pressed={on} onClick={() => chooseDay(id)} aria-label={`${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}, ${n ? `${n} open` : "closed"}`} className={cn("tpd-cell tpd-pick flex min-w-0 flex-col items-start justify-between p-1.5 text-left @lg:p-2", on && "tpd-on", !n && "text-muted-foreground/45")}>
                  <b className={cn("font-display text-base leading-none tracking-[-0.03em] @lg:text-lg", +d === +today && "underline decoration-1 underline-offset-[5px]")}>{d.getDate()}</b>
                  {n ? <span className={cn("text-[0.625rem] tracking-[0.1em]", !on && "text-accent")}>{n}<span className="@max-2xl:hidden"> OPEN</span></span> : null}
                </button>
              );
            })}
          </div>
        )}
        {view === "month" ? (
          <div className="flex flex-col gap-2.5 p-4 @2xl:border-l @2xl:border-border">
            <span className="label">{dayName}</span>
            <span className="label text-muted-foreground">{dayList.length} open · {zone(pick.start, tz)}</span>
            {call && hours(dayList) ? <div className="@2xl:[--tw:2.875rem]">{hours(dayList)}</div> : <div className="tpd-grid">
              {dayList.map((s) => {
                const on = timed && s.start === pick.start;
                return (
                  <button key={s.start} type="button" aria-pressed={on} onClick={() => chooseTime(s)} className={cn("tpd-cell tpd-pick h-11 @lg:h-10 text-[0.8125rem] font-medium tabular-nums", on && "tpd-on")}>{clock(minutesOf(s.start))}</button>
                );
              })}
            </div>}
          </div>
        ) : null}
      </div>
      {view === "week" ? (
        call && hours(dayList) ? (
          <div key={pick.date} className="tpd-fade p-4 @lg:px-5">{hours(dayList)}</div>
        ) : (
        <div key={pick.date} className="tpd-fade grid grid-cols-1 gap-x-4 gap-y-2 p-4 @lg:grid-cols-[6rem_minmax(0,1fr)] @lg:gap-y-2.5 @lg:px-5">
          {times(dayList)}
        </div>
        )
      ) : null}
      <Bar>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <b className="font-display text-[1.0625rem] uppercase leading-none tracking-[-0.02em]">{name}</b>
          <span className={cn("label", !timed && "text-muted-foreground")}>{timed ? when : "Pick a time"}</span>
        </span>
        <button type="button" data-act="" disabled={!timed} onClick={() => { setErrors({}); setFail(""); go("form", 1); }} className="tpd-act">Continue {arrow(1)}</button>
      </Bar>
    </>
  );

  const opts = WHERE[slug];
  const form = (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void book(e.currentTarget);
      }}
      onInput={(e) => {
        const k = (e.target as HTMLElement).closest<HTMLElement>("[data-f]")?.dataset.f;
        if (k && errors[k]) setErrors((was) => Object.fromEntries(Object.entries(was).filter(([x]) => x !== k)));
      }}
      className={cn("flex min-h-0 flex-1 flex-col", step === "sending" && "tpd-busy")}
    >
      {head(
        <button type="button" disabled={step === "sending"} onClick={() => go("pick", -1)} className="tap-44 label flex items-center gap-2.5 transition-opacity hoverable:hover:opacity-60 disabled:opacity-40">
          {arrow(-1)}
          <span className="text-muted-foreground">02 Details</span>
        </button>,
        <span className="label text-muted-foreground">2 of 2</span>,
      )}
      <fieldset disabled={step === "sending"} className="contents">
        <Row label="Name" id="name" error={errors.name}>
          <span data-f="name" className="grid w-full grid-cols-2 gap-4">
            <input name="first" autoComplete="given-name" placeholder="First" aria-label="First name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "tpd-name-err" : undefined} className={field} />
            <input name="last" autoComplete="family-name" placeholder="Last" aria-label="Last name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "tpd-name-err" : undefined} className={cn(field, "border-l border-border pl-4")} />
          </span>
        </Row>
        <Row label="Email" id="email" error={errors.email}>
          <span data-f="email" className="contents"><input name="email" type="email" autoComplete="email" aria-label="Email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "tpd-email-err" : undefined} className={field} /></span>
        </Row>
        <Row label="Phone" id="phone" error={errors.phone}>
          <span data-f="phone" className="contents"><input name="phone" type="tel" inputMode="tel" autoComplete="tel" aria-label="Phone" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "tpd-phone-err" : undefined} placeholder="For the day itself" className={field} /></span>
        </Row>
        {needsWhere && opts && opts.length > 1 ? (
          <Row label="Where" id="where" error={errors.where}>
            <span data-f="where" className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex">
                {opts.map(([label]) => (
                  <label key={label} className="label -ml-px cursor-pointer first:ml-0">
                    <input type="radio" name="opt" value={label} checked={opt === label} onChange={() => setOpt(label)} className="peer sr-only" />
                    <span className="block border border-border px-3 py-2 transition-colors hoverable:hover:border-foreground peer-checked:relative peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">{label}</span>
                  </label>
                ))}
              </span>
              {opts.find(([l]) => l === opt)?.[1] ? <input name="detail" aria-label={opts.find(([l]) => l === opt)?.[1]} placeholder={opts.find(([l]) => l === opt)?.[1]} className={cn(field, "min-w-[10rem] flex-1")} /> : null}
            </span>
          </Row>
        ) : needsWhere && !opts ? (
          <Row label="Where" id="where" error={errors.where}>
            <span data-f="where" className="contents"><input name="where" aria-label="Where" placeholder="The studio, or an address" className={field} /></span>
          </Row>
        ) : null}
        {call ? (
          <Row label="On">
            <span className="py-1 text-sm normal-case">{call}<span className="text-muted-foreground">, the link comes with the confirmation</span></span>
          </Row>
        ) : null}
        <Row label="Notes" last>
          <input name="notes" aria-label="Anything I should know" placeholder="Optional" className={field} />
        </Row>
      </fieldset>
      <Bar line={step === "sending"}>
        {fail ? (
          <span role="alert" className="tpd-msg label">{fail}</span>
        ) : (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <b className="font-display text-[1.0625rem] uppercase leading-none tracking-[-0.02em]">{name}</b>
            <span className="label">{when}</span>
          </span>
        )}
        <button type="submit" data-act="" aria-busy={step === "sending"} className="tpd-act">{step === "sending" ? "Booking" : "Book it"}</button>
      </Bar>
    </form>
  );

  return (
    <div aria-label={title} role="region" className={cn("tpd @container !flex min-h-0 flex-col overflow-hidden", className)}>
      <div key={step === "sending" ? "form" : step} className="tpd-step flex min-h-0 flex-1 flex-col" style={{ "--tpd-dir": dir } as React.CSSProperties}>
        {step === "pick" ? picker : form}
      </div>
    </div>
  );
}

/** The foot of every step: what is picked, and the one thing to do. `line`
    runs the hairline along its top while a booking is sent. */
function Bar({ children, line }: { children: React.ReactNode; line?: boolean }) {
  return (
    <div className="relative mt-auto flex shrink-0 flex-col border-t border-border @lg:min-h-14 @lg:flex-row @lg:items-stretch">
      {line ? <span aria-hidden className="tpd-line absolute -top-px left-0 h-px w-full origin-left bg-foreground" /> : null}
      {React.Children.map(children, (c, i) => (i === 0 ? <div className="flex min-w-0 flex-1 items-center px-4 py-3 @lg:px-5 @lg:py-0">{c}</div> : c))}
    </div>
  );
}
