"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the time picker ──────────────────────────────────────────────
 * Cal.com's open times, drawn as the site draws everything else: a
 * ruler. Days are cards (a week, or the month) with how open each is;
 * the time is a large number you scrub along a ruler of ticks, and the
 * ticks that are not open are faded and skipped.
 *
 * It reads and books through Cal.com's public API, which needs no key
 * and allows any origin, so there is no server here: slots from
 * `/v2/slots`, a booking from `/v2/bookings`. The times are Cal.com's,
 * which already hold your working hours, both connected calendars and
 * the minimum notice.
 *
 * Behind `?picker` on the address while it is tried out
 * (`components/cal-embed.tsx`). Where an event takes a payment the
 * booking form is Cal.com's, so `fallback` (its own calendar) is shown.
 * ─────────────────────────────────────────────────────────────── */

const API = "https://api.cal.com/v2";
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** How far ahead times are asked for. */
const AHEAD = 120;

type Slot = { start: string; end: string };
type Pick = { date: string; min: number; start: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const minutesOf = (start: string) => +start.slice(11, 13) * 60 + +start.slice(14, 16);
const clock = (m: number): [string, string] => {
  const h = Math.floor(m / 60);
  return [`${((h + 11) % 12) + 1}:${pad(m % 60)}`, h % 24 < 12 ? "AM" : "PM"];
};

/* A view that folds shut and open, so Week and Month trade places smoothly. */
function Fold({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={!on}
      aria-hidden={!on}
      className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out-strong)]", on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
    >
      <div className="-m-1 min-h-0 overflow-hidden p-1">{children}</div>
    </div>
  );
}

export function TimePicker({
  path,
  title,
  className,
  fallback,
}: {
  /** "username/event-slug" */
  path: string;
  title: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [username, slug] = path.split("/");
  const [tz] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles");
  const [length, setLength] = React.useState(30);
  const [days, setDays] = React.useState<Record<string, Slot[]> | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "fallback">("loading");
  const [view, setView] = React.useState<"week" | "month">("week");
  const [anchor, setAnchor] = React.useState(() => new Date()); // the week or month on show
  const [pick, setPick] = React.useState<Pick | null>(null);
  const [chosen, setChosen] = React.useState(false); // a time picked by hand, not the first one offered
  const [step, setStep] = React.useState<"pick" | "form" | "sending" | "done">("pick");
  const [error, setError] = React.useState("");
  const ruler = React.useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const from = new Date();
      const to = new Date(Date.now() + AHEAD * 864e5);
      const [meta, slots] = await Promise.all([
        fetch(`${API}/event-types?username=${username}&eventSlug=${slug}`, { headers: { "cal-api-version": "2024-06-14" } }).then((r) => r.json()),
        fetch(`${API}/slots?username=${username}&eventTypeSlug=${slug}&start=${iso(from)}&end=${iso(to)}&timeZone=${encodeURIComponent(tz)}&format=range`, {
          headers: { "cal-api-version": "2024-09-04" },
        }).then((r) => r.json()),
      ]);
      const ev = Array.isArray(meta.data) ? meta.data[0] : meta.data;
      if (!ev || slots.status !== "success") throw new Error("no times");
      // A paid event is booked on Cal.com's own form, where the payment is.
      if ((ev.price ?? 0) > 0 || ev.requiresConfirmation) {
        setState("fallback");
        return;
      }
      setLength(ev.lengthInMinutes || 30);
      setDays(slots.data);
      setState("ready");
    } catch {
      setState("fallback");
    }
  }, [username, slug, tz]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /* The ruler's span, from every open time loaded, to the hour. */
  const { lo, hi } = React.useMemo(() => {
    let a = 24 * 60;
    let b = 0;
    for (const list of Object.values(days ?? {})) {
      for (const s of list) {
        const m = minutesOf(s.start);
        a = Math.min(a, m);
        b = Math.max(b, m + length);
      }
    }
    if (a > b) return { lo: 600, hi: 1080 };
    return { lo: Math.floor(a / 60) * 60, hi: Math.ceil(b / 60) * 60 };
  }, [days, length]);

  const open = (date: string) => new Set((days?.[date] ?? []).map((s) => minutesOf(s.start)));
  const steps = React.useMemo(() => Array.from({ length: Math.max(1, Math.round((hi - lo) / length)) }, (_, i) => lo + i * length), [lo, hi, length]);

  /* First open day and time, once there are any. */
  React.useEffect(() => {
    if (state !== "ready" || !days || pick) return;
    const date = Object.keys(days).filter((d) => days[d].length).sort()[0];
    if (!date) return;
    const s = days[date][0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPick({ date, min: minutesOf(s.start), start: s.start });
    setAnchor(fromIso(date));
  }, [state, days, pick]);

  const choose = (date: string, min?: number) => {
    const list = days?.[date];
    if (!list?.length) return;
    setChosen(true);
    const s = list.find((x) => minutesOf(x.start) === min) ?? list[0];
    setPick({ date, min: minutesOf(s.start), start: s.start });
  };

  /* The nearest open time to a point along the ruler. */
  const nearest = (clientX: number) => {
    const r = ruler.current!.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    const raw = lo + (x / r.width) * (hi - lo) - length / 2;
    const ok = open(pick!.date);
    let best: number | undefined;
    for (const m of ok) if (best === undefined || Math.abs(m - raw) < Math.abs(best - raw)) best = m;
    return { x, best };
  };
  const dragging = React.useRef(false);
  const onKey = (e: React.KeyboardEvent) => {
    if (!pick) return;
    const ok = [...open(pick.date)].sort((a, b) => a - b);
    const i = ok.indexOf(pick.min);
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? ok[i + 1] : e.key === "ArrowLeft" || e.key === "ArrowDown" ? ok[i - 1] : undefined;
    if (next !== undefined) {
      e.preventDefault();
      choose(pick.date, next);
    }
  };

  /* The week or month under the cards. */
  const week = React.useMemo(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      return x;
    });
  }, [anchor]);
  const month = React.useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  }, [anchor]);
  const shift = (dir: number) => {
    const d = new Date(anchor);
    if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    setAnchor(d);
  };

  const book = async (form: FormData) => {
    if (!pick) return;
    setStep("sending");
    setError("");
    const where = String(form.get("where") || "").trim();
    const notes = String(form.get("notes") || "").trim();
    try {
      const res = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
        body: JSON.stringify({
          start: new Date(pick.start).toISOString(),
          eventTypeSlug: slug,
          username,
          attendee: { name: String(form.get("name")), email: String(form.get("email")), timeZone: tz, language: "en" },
          bookingFieldsResponses: { notes: [where && `Where: ${where}`, notes].filter(Boolean).join("\n") },
        }),
      });
      const body = await res.json();
      if (!res.ok || body.status !== "success") throw new Error(body?.error?.message || "failed");
      setStep("done");
    } catch (e) {
      setError(/(already|not available|busy|booked)/i.test(String(e)) ? "That time was just taken. Pick another." : "That did not go through. Try again, or write to hello@juliangigola.com.");
      setStep("form");
      void load();
    }
  };

  if (state === "fallback") return <>{fallback}</>;
  if (state === "loading" || !days) {
    return (
      <div aria-label={title} className={cn("flex items-center justify-center", className)}>
        <p className="label text-muted-foreground">Loading times</p>
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

  const [t, ap] = clock(pick.min);
  const [until] = clock(pick.min + length);
  const okNow = open(pick.date);
  const date = fromIso(pick.date);
  const sum = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} · ${t} ${ap}`;

  if (step === "done") {
    return (
      <div aria-label={title} className={cn("flex flex-col justify-center gap-4 p-6 sm:p-10", className)}>
        <p className="label text-muted-foreground">Booked</p>
        <p className="font-display text-5xl uppercase leading-[0.92] sm:text-7xl">{sum}</p>
        <p className="max-w-[28rem] text-sm normal-case leading-relaxed text-muted-foreground">
          A confirmation is on its way to your email, with the details. I&rsquo;ll be in touch before the day.
        </p>
      </div>
    );
  }

  return (
    <div aria-label={title} role="region" className={cn("tp flex min-h-0 flex-col gap-8 overflow-y-auto overscroll-contain p-5 sm:gap-10 sm:p-10", className)}>
      {/* the days */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="label flex items-center gap-4 text-muted-foreground">
            <button type="button" aria-label="Earlier" onClick={() => shift(-1)} className="tap-44 px-1 hoverable:hover:text-foreground">&larr;</button>
            <span className="text-foreground">{view === "week" ? `${MONTHS[week[0].getMonth()]} ${week[0].getDate()}` + (week[6].getMonth() !== week[0].getMonth() ? ` to ${MONTHS[week[6].getMonth()]} ${week[6].getDate()}` : ` to ${week[6].getDate()}`) : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}</span>
            <button type="button" aria-label="Later" onClick={() => shift(1)} className="tap-44 px-1 hoverable:hover:text-foreground">&rarr;</button>
          </div>
          <div className="label flex gap-4">
            {(["week", "month"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("border-b pb-1 transition-colors duration-200", view === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hoverable:hover:text-foreground")}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <Fold on={view === "week"}>
          <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
            {week.map((d) => {
              const id = iso(d);
              const o = open(id);
              const on = pick.date === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!o.size}
                  aria-pressed={on}
                  onClick={() => choose(id, pick.min)}
                  className={cn(
                    "flex flex-col gap-2 rounded-[6px] border p-2.5 text-left transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] sm:p-3",
                    on ? "border-foreground bg-foreground text-background" : "border-border hoverable:hover:-translate-y-0.5",
                    !o.size && "pointer-events-none opacity-30",
                  )}
                >
                  <span className="label opacity-70">{DAYS[d.getDay()]}</span>
                  <b className="font-display text-xl leading-none sm:text-3xl">{d.getDate()}</b>
                  <span aria-hidden className="flex h-3.5 items-end gap-px">
                    {steps.map((m) => (
                      <s key={m} className="w-[3px] max-sm:w-px flex-1 rounded-[1px] bg-current no-underline opacity-55 transition-[height] duration-500" style={{ height: o.has(m) ? 14 : 3 }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </Fold>
        <Fold on={view === "month"}>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAYS.map((d) => (
              <span key={d} className="label pb-1 text-muted-foreground">{d[0]}<span className="max-sm:hidden">{d.slice(1)}</span></span>
            ))}
            {month.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const id = iso(d);
              const o = open(id);
              const on = pick.date === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!o.size}
                  aria-pressed={on}
                  onClick={() => choose(id, pick.min)}
                  className={cn(
                    "flex aspect-[1/0.8] flex-col justify-between rounded-[6px] border p-2 text-left transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] sm:aspect-[1/0.6]",
                    on ? "border-foreground bg-foreground text-background" : "border-border hoverable:hover:-translate-y-0.5",
                    !o.size && "pointer-events-none opacity-30",
                  )}
                >
                  <b className="font-display text-base leading-none sm:text-xl">{d.getDate()}</b>
                  <span aria-hidden className="h-[3px] w-full bg-current/20">
                    <span className="block h-full bg-current" style={{ width: `${(o.size / steps.length) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </Fold>
      </div>

      {/* the time */}
      <div className="mt-6 flex items-baseline gap-3 sm:mt-8">
        <div aria-hidden className="font-display flex text-[clamp(4.5rem,13vw,9rem)] leading-[0.85] tabular-nums tracking-[-0.05em]">
          {[...t].map((c, i) => (
            <span key={`${i}${c}`} className="tp-roll inline-block">{c}</span>
          ))}
        </div>
        <span className="label">{ap}</span>
        <span className="label ml-auto text-right text-muted-foreground">Until<br />{until} {clock(pick.min + length)[1]}</span>
      </div>

      {/* the ruler */}
      <div
        ref={ruler}
        role="slider"
        tabIndex={0}
        aria-label="Time"
        aria-valuemin={lo}
        aria-valuemax={hi - length}
        aria-valuenow={pick.min}
        aria-valuetext={`${t} ${ap}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const { best } = nearest(e.clientX);
          if (best !== undefined) choose(pick.date, best);
        }}
        onPointerMove={(e) => {
          const { x, best } = nearest(e.clientX);
          setGhost(x);
          if (dragging.current && best !== undefined && best !== pick.min) choose(pick.date, best);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => setGhost(null)}
        className="relative mb-10 mt-2 h-24 cursor-ew-resize touch-none select-none outline-none focus-visible:[&>.ticks]:opacity-100"
      >
        <div className="ticks absolute inset-0 flex items-end justify-between">
          {Array.from({ length: Math.round((hi - lo) / (length >= 30 ? length / 2 : length)) + 1 }, (_, i) => {
            const m = lo + i * (length >= 30 ? length / 2 : length);
            const slot = (m - lo) % length === 0 && m < hi;
            const isOpen = okNow.has(m);
            const sel = m === pick.min;
            const near = !sel && isOpen && Math.abs(m - pick.min) <= length;
            const hour = m % 60 === 0;
            return (
              <span
                key={m}
                className={cn(
                  "w-px bg-foreground transition-[height,opacity,width] duration-300 ease-[var(--ease-out-strong)]",
                  sel ? "w-0.5" : "",
                )}
                style={{
                  height: sel ? 84 : near ? 62 : slot && !isOpen ? 10 : hour ? 44 : 22,
                  opacity: slot && !isOpen ? 0.22 : 0.9,
                }}
              />
            );
          })}
        </div>
        {ghost !== null ? <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-foreground/25" style={{ left: ghost }} /> : null}
        {Array.from({ length: Math.floor((hi - lo) / 60) + 1 }, (_, i) => lo + i * 60).map((m) => (
          <span key={m} aria-hidden className="label absolute -bottom-6 -translate-x-1/2 text-[0.625rem] text-muted-foreground" style={{ left: `${((m - lo) / (hi - lo)) * 100}%` }}>
            {clock(m)[0].replace(":00", "")}
          </span>
        ))}
      </div>

      {/* confirm */}
      {step === "pick" ? (
        <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
          <span className="label text-muted-foreground">{sum} · {tz.replace(/_/g, " ")}</span>
          <button type="button" onClick={() => setStep("form")} disabled={!chosen} className="label relative isolate overflow-hidden rounded-[2px] border border-foreground px-6 py-4 transition-[color,opacity] duration-500 before:absolute before:inset-0 before:-z-10 before:-translate-x-[101%] before:bg-foreground before:transition-transform before:duration-500 before:ease-[var(--ease-out-strong)] hoverable:hover:text-background hoverable:hover:before:translate-x-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35">
            Confirm this time
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void book(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-4 border-t border-border pt-5"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="label">{sum}</span>
            <button type="button" onClick={() => setStep("pick")} className="label text-muted-foreground hoverable:hover:text-foreground">Change</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label flex flex-col gap-2 text-muted-foreground">Name<input name="name" required autoComplete="name" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
            <label className="label flex flex-col gap-2 text-muted-foreground">Email<input name="email" type="email" required autoComplete="email" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          </div>
          <label className="label flex flex-col gap-2 text-muted-foreground">Where, if on location<input name="where" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          <label className="label flex flex-col gap-2 text-muted-foreground">Anything I should know<textarea name="notes" rows={2} className="resize-none border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          {error ? <p role="alert" className="text-sm normal-case text-foreground">{error}</p> : null}
          <button type="submit" disabled={step === "sending"} className="label action self-start px-6 py-4 press active:scale-[0.97] disabled:opacity-50">
            {step === "sending" ? "Booking" : "Book it"}
          </button>
        </form>
      )}
    </div>
  );
}
