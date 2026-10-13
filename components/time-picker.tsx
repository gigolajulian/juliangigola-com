"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the time picker ──────────────────────────────────────────────
 * Cal.com's open times, in two plain steps: a day, then a time. Days
 * are cards (a week, or the month) with how open each is; the open times
 * of the day picked are buttons, and the one picked is the large number.
 * Julian: the ruler of ticks was too minimal to read at a glance.
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
/* An event's details and times, kept a minute, so a picker built again
   (the homepage menu builds one per row pointed at) does not ask Cal.com
   again. A reload after a failed booking asks fresh. */
const KEEP = 60_000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recent = new Map<string, { at: number; got: Promise<[any, any]> }>();
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
/** The kinds of time the open times are grouped in, by start, in minutes. */
const PARTS = [["Morning", 0, 720], ["Afternoon", 720, 1020], ["Evening", 1020, 1440]] as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** How far ahead times are asked for. */
const AHEAD = 120;

type Slot = { start: string; end: string };
type Pick = { date: string; min: number; start: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const minutesOf = (start: string) => +start.slice(11, 13) * 60 + +start.slice(14, 16);
/** Where the session happens, per event: the choices, and what to ask after one. An event
    with a single choice asks nothing; one not listed gets a plain text box. */
const WHERE: Record<string, [label: string, ask?: string][]> = {
  graduation: [["On campus", "Which campus?"], ["In studio"]],
  portraits: [["Studio"], ["Outdoor", "Where?"], ["Your location", "Where?"]],
  headshots: [["Studio"], ["On location", "Address"]],
  digitals: [["Studio"]],
};

/** "San Jose PDT" (or PST, by the date) for a Pacific visitor, where the
    studio is; the zone's own short name elsewhere. */
const zone = (start: string, tz: string) => {
  const short =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date(start))
      .find((p) => p.type === "timeZoneName")?.value ?? tz.replace(/_/g, " ");
  return tz === "America/Los_Angeles" ? `San Jose ${short}` : short;
};
/** A phone number as +E.164: a US number without its country code gets +1. */
const e164 = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return "";
};
const clock = (m: number): [string, string] => {
  const h = Math.floor(m / 60);
  return [`${((h + 11) % 12) + 1}:${pad(m % 60)}`, h % 24 < 12 ? "AM" : "PM"];
};

/* How far the picker runs past its own padding. Its scrollHeight missed
   the bar running into the bottom padding, and Confirm sat on the card's
   edge (Julian). Offsets, not rects, so a zoomed page measures true. */
const overflowOf = (tp: HTMLElement) => {
  const bar = tp.querySelector<HTMLElement>(":scope > .sticky");
  const end = tp.clientHeight - parseFloat(getComputedStyle(tp).paddingBottom);
  // Where the picker grows with its times (a service page's call), the
  // box around it is what clips, so its overflow counts too.
  const host = tp.parentElement;
  return Math.max(tp.scrollHeight - tp.clientHeight, host ? host.scrollHeight - host.clientHeight : 0, bar ? Math.ceil(bar.offsetTop + bar.offsetHeight - end - 1) : 0); // 1px: offsets round
};

/* The day's open times as bars: the week and the month draw a day the
   same way (Julian, 2026-10-11). */
function Bars({ steps, open, on, className }: { steps: number[]; open: Set<number>; on: boolean; className?: string }) {
  return (
    // A day of quarter hours on a phone tile: the gaps alone were wider
    // than the tile and the bars went to nothing.
    <span aria-hidden className={cn("flex items-end bg-current/10", steps.length > 16 ? "gap-0" : "gap-px", !on && "text-accent", className)}>
      {steps.map((m) => (
        <s key={m} className="w-[3px] max-sm:w-px flex-1 rounded-[1px] bg-current no-underline opacity-55 transition-[height] duration-500" style={{ height: open.has(m) ? "100%" : "22%" }} />
      ))}
    </span>
  );
}

/* A view that folds shut and open, so Week and Month trade places smoothly. */
/** `fill`: open, it takes the room the picker has to spare, and its
    children stack so one can be pushed down with `mt-auto`. */
function Fold({ on, fill, children }: { on: boolean; fill?: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={!on}
      aria-hidden={!on}
      className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out-strong)]", on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0", fill && on && "flex-1")}
    >
      <div className={cn("-m-1 min-h-0 overflow-hidden p-1", fill && "flex flex-col")}>{children}</div>
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
  /* Julian: the time where I am, with the place, before a time is picked. */
  const clockHere = () => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date());
  const [here, setHere] = React.useState(clockHere);
  React.useEffect(() => {
    const t = setInterval(() => setHere(clockHere()), 15000);
    return () => clearInterval(t);
  }, []);
  const [length, setLength] = React.useState(30);
  /** The event takes its place from the visitor (a studio session or their own address). */
  const [needsWhere, setNeedsWhere] = React.useState(false);
  const [opt, setOpt] = React.useState("");
  /** The follow-up question, kept while it folds shut so its text does not vanish first. */
  const [ask, setAsk] = React.useState("");
  const [session, setSession] = React.useState("");
  /** Who booked, for the page that follows. */
  const [booked, setBooked] = React.useState({ name: "", email: "", where: "" });
  const [days, setDays] = React.useState<Record<string, Slot[]> | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "fallback">("loading");
  const [view, setView] = React.useState<"week" | "month">("week");
  const [anchor, setAnchor] = React.useState(() => new Date()); // the week or month on show
  const [pick, setPick] = React.useState<Pick | null>(null);
  /* Julian: the arrows more defined, larger. Drawn, not the font's. */
  const arrow = (
    <svg aria-hidden viewBox="0 0 22 16" className="h-4 w-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square">
      <path d="M20.5 8H2.5M6.5 5 2.5 8 6.5 11" />
    </svg>
  );
  /* What has been picked by hand: nothing (the first open time is only
     on show), a day, or a day and its time. A day alone keeps Confirm off:
     clicking one used to pick its time as well, skipping step two. */
  const [chosen, setChosen] = React.useState<false | "day" | "time">(false);
  const [step, setStep] = React.useState<"pick" | "form" | "sending" | "check" | "done">("pick");
  const [error, setError] = React.useState("");
  /* Julian: Confirm's words turn into the orbs, then a check, before the
     form opens. */
  const [ok, setOk] = React.useState<"" | "spin" | "tick">("");
  React.useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => {
      if (ok === "spin") return setOk("tick");
      setOk("");
      setStep("form");
    }, ok === "spin" ? 600 : 800);
    return () => window.clearTimeout(t);
  }, [ok]);

  const load = React.useCallback(async (fresh = false) => {
    const key = `${username}/${slug}/${tz}`;
    try {
      const from = new Date();
      const to = new Date(Date.now() + AHEAD * 864e5);
      // Cal.com not answering at all left "Loading times" up for good: past
      // 8 seconds its own calendar takes over, as for any other failure.
      const signal = AbortSignal.timeout?.(8000);
      const hit = recent.get(key);
      const got = !fresh && hit && Date.now() - hit.at < KEEP ? hit.got : Promise.all([
        fetch(`${API}/event-types?username=${username}&eventSlug=${slug}`, { headers: { "cal-api-version": "2024-06-14" }, signal }).then((r) => r.json()),
        fetch(`${API}/slots?username=${username}&eventTypeSlug=${slug}&start=${iso(from)}&end=${iso(to)}&timeZone=${encodeURIComponent(tz)}&format=range`, {
          headers: { "cal-api-version": "2024-09-04" },
          signal,
        }).then((r) => r.json()),
      ]);
      if (got !== hit?.got) recent.set(key, { at: Date.now(), got });
      const [meta, slots] = await got;
      const ev = Array.isArray(meta.data) ? meta.data[0] : meta.data;
      if (!ev || slots.status !== "success") throw new Error("no times");
      // A paid event is booked on Cal.com's own form, where the payment is.
      if ((ev.price ?? 0) > 0 || ev.requiresConfirmation) {
        setState("fallback");
        return;
      }
      setLength(ev.lengthInMinutes || 30);
      setSession(ev.title || "");
      setNeedsWhere(Array.isArray(ev.locations) && ev.locations.some((l: { type: string }) => l.type === "attendeeDefined"));
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

  /* The time picked went (taken while the form was filled in, and the
     times loaded again): the day stays, the time is to pick again. */
  React.useEffect(() => {
    if (!pick || chosen !== "time" || !days) return;
    if (!days[pick.date]?.some((x) => minutesOf(x.start) === pick.min)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChosen("day");
    }
  }, [days, pick, chosen]);

  /* A time button picks the time; a day keeps the time already picked
     when that day has it open, and otherwise waits for one. */
  const choose = (date: string, min: number, time: boolean) => {
    const list = days?.[date];
    if (!list?.length) return;
    const s = list.find((x) => minutesOf(x.start) === min);
    setChosen(time || (s && chosen === "time") ? "time" : "day");
    const t = s ?? list[0];
    setPick({ date, min: minutesOf(t.start), start: t.start });
  };

  /* A day picked in a month brings its times up on a phone, where the
     card is as tall as it needs and the page scrolls (Julian, 2026-10-11). */
  const showTimes = () =>
    requestAnimationFrame(() => {
      const box = slotsBox.current;
      if (!box?.offsetParent || !matchMedia("(max-width: 39.99rem)").matches) return;
      const r = box.getBoundingClientRect();
      if (r.top > innerHeight * 0.6) scrollBy({ top: r.top - innerHeight * 0.25, behavior: "smooth" });
    });

  /* The week or month under the cards. A week is the seven days from the
     one on show, never from before today: a calendar week opened on a
     Saturday was six days already gone. */
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const week = React.useMemo(() => {
    const d = new Date(Math.max(+anchor, +today));
    d.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      return x;
    });
  }, [anchor, today]);
  const month = React.useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  }, [anchor]);
  /* Julian: an earlier or later week or month slides in from its side
     (`[data-slide]`, contact.css). Not on a switch between the two,
     which has its own glide below. */
  const [slide, setSlide] = React.useState(0);
  const shift = (dir: number) => {
    setSlide(dir);
    const d = new Date(view === "week" ? week[0] : anchor);
    if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    setAnchor(d);
  };
  /* Week and month trade places as one set of cards: each day glides from
     where it stood to where it lands and the box eases to its new height,
     a day that was not on show fades in. Measured before the switch,
     played once the new view is laid out. */
  const daysBox = React.useRef<HTMLDivElement>(null);
  const flip = React.useRef<{ at: Map<string, DOMRect>; h: number } | null>(null);
  /* Where a month and a day's times do not fit together (`data-split`,
     below): the month, then the day's times in its place. Julian, no
     scroll in the card, ever (2026-10-11). */
  const [mstep, setMstep] = React.useState<"days" | "times">("days");
  const switchView = (v: "week" | "month") => {
    if (v === view) return;
    setSlide(0);
    setMstep("days");
    const box = daysBox.current;
    if (box) {
      const at = new Map<string, DOMRect>();
      for (const b of box.querySelectorAll<HTMLElement>("[data-day]")) at.set(b.dataset.day!, b.getBoundingClientRect());
      flip.current = { at, h: box.offsetHeight };
    }
    // Into the week from a month: the week of the day picked, when it is in that month.
    if (v === "week" && pick && fromIso(pick.date).getMonth() === anchor.getMonth()) setAnchor(fromIso(pick.date));
    setView(v);
  };
  /* A month as tall as the picker has room for: past it, the confirm bar
     sat over the ruler (six rows, or a short window). The cells give up
     what the picker overflows by, shared between the rows. */
  const monthGrid = React.useRef<HTMLDivElement>(null);
  /* And a week: its big time gives up what the picker overflows by (the
     times in kinds took a row more, past an iPad held sideways). */
  const big = React.useRef<HTMLDivElement>(null);
  /* The times' width: they keep to one line while every box has room for
     its time (Julian: a day of half hours was crammed). */
  const slotsBox = React.useRef<HTMLDivElement>(null);
  const [slotsW, setSlotsW] = React.useState(0);
  const picked = !!pick;
  React.useLayoutEffect(() => {
    const el = slotsBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSlotsW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [picked]);
  React.useLayoutEffect(() => {
    const el = big.current;
    const tp = el?.closest<HTMLElement>(".tp");
    if (view !== "week" || !el || !tp) return;
    const row = el.parentElement!;
    const block = row.parentElement!;
    // The spare height around it (Julian's spacers) goes with it, or its
    // room stayed as an empty band (audit, 2026-10-11).
    const over = block.previousElementSibling as HTMLElement | null;
    const under = block.nextElementSibling as HTMLElement | null;
    const fit = () => {
      el.style.removeProperty("font-size");
      row.style.removeProperty("display");
      block.style.removeProperty("display");
      over?.style.removeProperty("display");
      under?.style.removeProperty("max-height");
      tp.removeAttribute("data-tight");
      tp.removeAttribute("data-split");
      // Twice: the line it sits on does not give back all it shrinks by.
      for (let i = 0; i < 2; i++) {
        const over = overflowOf(tp);
        if (over > 0) el.style.fontSize = `${Math.max(48, parseFloat(getComputedStyle(el).fontSize) - over / 0.85)}px`;
      }
      // Smaller than that it is not worth its row: the day over it and the
      // time picked below say the same, as under a month.
      if (overflowOf(tp) > 0) row.style.display = "none";
      // Still over (a day of half hours on an iPad held sideways): the day
      // goes too, the bar under the times says it.
      if (overflowOf(tp) > 0) {
        block.style.display = "none";
        if (over) over.style.display = "none";
        under?.style.setProperty("max-height", "var(--tp-gap, 2rem)");
      }
      // Still over (half-hour calls at 1280x720): the steps' names go and
      // the times close up (`[data-tight]`, contact.css).
      if (overflowOf(tp) > 0) tp.setAttribute("data-tight", "");
      // Still over (a phone on its side): the week, then the day's times
      // in its place, as a month that does not fit (`data-split`).
      if (overflowOf(tp) > 0) tp.setAttribute("data-split", "");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(tp);
    return () => {
      ro.disconnect();
      tp.removeAttribute("data-tight");
      tp.removeAttribute("data-split");
    };
  }, [view, pick?.date, days, slotsW, mstep]);
  const refit = React.useRef(() => {});
  React.useLayoutEffect(() => {
    const grid = monthGrid.current;
    const tp = grid?.closest<HTMLElement>(".tp");
    if (view !== "month" || !grid || !tp) return;
    // The fold the days sit in can shrink and hide what does not fit, so
    // its own overflow counts as well as the picker's.
    const fold = grid.closest<HTMLElement>(".min-h-0.overflow-hidden");
    const overBy = () => Math.max(overflowOf(tp), fold ? fold.scrollHeight - fold.clientHeight : 0);
    const rows = Math.ceil((grid.children.length - 7) / 7);
    /* The cells give up what the picker is over by, down to `least`. */
    const squeeze = (least: number) => {
      grid.style.removeProperty("--cell-h");
      const cell = grid.querySelector<HTMLElement>("[data-day]");
      if (!cell?.offsetHeight) return 0;
      // Twice, for what the first pass leaves over by rounding.
      for (let i = 0; i < 2; i++) {
        const over = overBy();
        if (over <= 0) return 0;
        grid.style.setProperty("--cell-h", `${Math.max(least, cell.offsetHeight - Math.ceil(over / rows))}px`);
      }
      return overBy();
    };
    const fit = () => {
      tp.removeAttribute("data-split");
      // Both, while a cell keeps 2.5rem: under it they were strips.
      if (squeeze(40) <= 0) return;
      tp.setAttribute("data-split", "");
      squeeze(28);
    };
    fit();
    refit.current = fit;
    const ro = new ResizeObserver(fit);
    ro.observe(tp);
    return () => {
      ro.disconnect();
      refit.current = () => {};
      tp.removeAttribute("data-split");
    };
  }, [view, month, pick?.date, days, mstep]);
  React.useLayoutEffect(() => {
    const f = flip.current;
    flip.current = null;
    const box = daysBox.current;
    if (!f || !box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ms = 520;
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    // Measured again once the box is at its height: until then it hides what overflows.
    box.animate([{ height: `${f.h}px` }, { height: `${box.offsetHeight}px` }], { duration: ms, easing }).finished.then(() => refit.current(), () => {});
    let n = 0;
    for (const el of box.querySelectorAll<HTMLElement>("[data-day]")) {
      const to = el.getBoundingClientRect();
      const from = f.at.get(el.dataset.day!);
      if (from) {
        el.animate(
          [
            { transformOrigin: "0 0", transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
            { transformOrigin: "0 0", transform: "none" },
          ],
          { duration: ms, easing },
        );
      } else {
        el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: 80 + n++ * 9, easing, fill: "backwards" });
      }
    }
  }, [view]);
  /* Nothing to go back to before today. */
  const atStart = view === "week" ? +week[0] <= +today : anchor.getFullYear() * 12 + anchor.getMonth() <= today.getFullYear() * 12 + today.getMonth();

  const book = async (form: FormData) => {
    if (!pick) return;
    setStep("sending");
    setError("");
    const began = Date.now();
    const opts = WHERE[slug];
    const picked = opts?.length === 1 ? opts[0][0] : String(form.get("opt") || "");
    const asked = opts?.find(([label]) => label === picked)?.[1];
    const where = opts ? [picked, asked ? String(form.get("detail") || "").trim() : ""].filter(Boolean).join(": ") : String(form.get("where") || "").trim();
    const phone = e164(String(form.get("phone") || ""));
    if (!phone) {
      setError("Check your phone number. Add the country code if it is not a US number.");
      setStep("form");
      return;
    }
    const notes = String(form.get("notes") || "").trim();
    try {
      const res = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
        body: JSON.stringify({
          start: new Date(pick.start).toISOString(),
          eventTypeSlug: slug,
          username,
          attendee: { name: `${String(form.get("first")).trim()} ${String(form.get("last")).trim()}`, email: String(form.get("email")), phoneNumber: phone, timeZone: tz, language: "en" },
          ...(needsWhere ? { location: { type: "attendeeDefined", location: where } } : {}),
          bookingFieldsResponses: { notes: [`Phone: ${phone}`, notes].filter(Boolean).join("\n") },
        }),
      });
      const body = await res.json();
      if (!res.ok || body.status !== "success") throw new Error(body?.error?.message || "failed");
      setBooked({ name: String(form.get("first")).trim(), email: String(form.get("email")).trim(), where });
      /* The orbs get their moment even when Cal.com answers at once, then
         turn into the check, which is shown before the page that follows. */
      await new Promise((go) => setTimeout(go, Math.max(0, 1100 - (Date.now() - began))));
      setStep("check");
      await new Promise((go) => setTimeout(go, 1500));
      // The time is taken now: the next picker asks Cal.com again.
      recent.delete(`${username}/${slug}/${tz}`);
      setStep("done");
    } catch (e) {
      setError(/(already|not available|busy|booked)/i.test(String(e)) ? "That time was just taken. Pick another." : "That did not go through. Try again, or write to hello@juliangigola.com.");
      setStep("form");
      void load(true);
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
  const date = fromIso(pick.date);
  const sum = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} · ${t} ${ap}`;

  if (step === "done") {
    const first = booked.name.split(/\s+/)[0];
    const rows: [string, string][] = [
      ["Session", `${session || title}, ${length} min`],
      ["When", `${sum.replace(" · ", " at ")} ${zone(pick.start, tz)}`],
      ...(booked.where ? ([["Where", booked.where]] as [string, string][]) : []),
      ["Confirmation", booked.email],
    ];
    const next = ["The confirmation is in your inbox now.", "I write to you before the day with the details.", "Need another time? The email has a link to move or cancel it."];
    return (
      <div aria-label={title} role="status" className={cn("tp !flex min-h-[30rem] flex-col justify-center gap-6 p-6 sm:gap-8 sm:p-10 [&>*]:shrink-0", className)}>
        <div className="flex flex-col gap-4">
          <p className="label tp-roll text-muted-foreground">Booked</p>
          <h3 className="tp-roll font-display text-[clamp(2.5rem,9.5cqw,5.5rem)] uppercase leading-[0.9] [text-wrap:balance] tracking-[-0.04em]" style={{ animationDelay: "80ms" }}>
            {first ? `${first}, you’re in.` : "You’re in."}
          </h3>
        </div>
        <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {rows.map(([k, v], n) => (
            <div key={k} className="tp-roll flex min-w-0 flex-col gap-1.5" style={{ animationDelay: `${200 + n * 70}ms` }}>
              <dt className="label text-muted-foreground">{k}</dt>
              <dd className="break-words text-base normal-case leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <p className="label tp-roll text-muted-foreground" style={{ animationDelay: "480ms" }}>What&rsquo;s next</p>
          <ol className="flex flex-col gap-2 text-sm normal-case leading-relaxed text-muted-foreground sm:flex-row sm:gap-10">
          {next.map((t, n) => (
            <li key={t} className="tp-roll flex gap-3 sm:max-w-[16rem]" style={{ animationDelay: `${520 + n * 90}ms` }}>
              <span className="label text-foreground">{`0${n + 1}`}</span>
              {t}
            </li>
          ))}
        </ol>
        </div>
      </div>
    );
  }

  return (
    <div aria-label={title} role="region" data-view={view} data-mstep={mstep} className={cn("tp @container relative !flex min-h-0 flex-col overflow-x-clip p-5 sm:p-10 max-[56rem]:sm:p-6 tp-short:p-5 max-sm:!px-1", className)}>
      {step === "sending" || step === "check" ? (
        <div role="status" aria-live="polite" className="absolute inset-0 z-20 bg-background/85 backdrop-blur-md">
          <div className="sticky top-[28%] flex flex-col items-center gap-6 py-10">
            <div className="tp-status relative size-28" data-ok={step === "check" ? "" : undefined}>
              {[
                ["2.4s", "1.125rem", "1"],
                ["3.4s", "0.875rem", "0.7"],
                ["1.7s", "0.625rem", "0.5"],
                ["4.6s", "0.5rem", "0.35"],
              ].map(([d, size, o], n) => (
                <span key={n} className="tp-arm absolute inset-0" style={{ animationDuration: d, animationDirection: n % 2 ? "reverse" : "normal" }}>
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-foreground" style={{ width: size, height: size, opacity: o }} />
                </span>
              ))}
              <svg viewBox="0 0 112 112" className="absolute inset-0 size-full" fill="none" aria-hidden>
                <circle className="tp-ring stroke-accent" cx="56" cy="56" r="44" strokeWidth="3" strokeLinecap="round" />
                <path className="tp-tick stroke-accent" d="M38 58l12 12 24-26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="label text-muted-foreground">{step === "check" ? "Booked" : "Booking"}</p>
          </div>
        </div>
      ) : null}
      {/* the days, the time and the ruler fold away once a time is confirmed, so the form fits */}
      <Fold on={step === "pick"} fill>
      {/* the days */}
      <div data-part="days" className="flex flex-col gap-5 tp-short:gap-3">
        <p className="label text-muted-foreground"><span className="mr-3 text-foreground">01</span>Pick a day</p>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="label flex items-center gap-2 whitespace-nowrap text-muted-foreground @md:gap-4">
            <button type="button" aria-label="Earlier" onClick={() => shift(-1)} disabled={atStart} className="tap-44 flex h-9 items-center justify-center px-1 text-foreground transition-opacity duration-200 hoverable:hover:opacity-60 disabled:opacity-30">{arrow}</button>
            {/* As wide as the longest it gets, so the arrows hold still. */}
            <span className="grid text-center text-foreground">
              <span aria-hidden className="invisible [grid-area:1/1]">Sep 22 to Sep 28</span>
              <span className="[grid-area:1/1]">{view === "week" ? `${MONTHS[week[0].getMonth()].slice(0, 3)} ${week[0].getDate()} to ${MONTHS[week[6].getMonth()].slice(0, 3)} ${week[6].getDate()}` : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`}</span>
            </span>
            <button type="button" aria-label="Later" onClick={() => shift(1)} className="tap-44 flex h-9 items-center justify-center px-1 text-foreground transition-opacity duration-200 hoverable:hover:opacity-60"><span className="flex rotate-180">{arrow}</span></button>
          </div>
          <div className="label ml-auto flex gap-4">
            {(["week", "month"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)} className={cn("tap-44 border-b pb-1 transition-colors duration-200", view === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hoverable:hover:text-foreground")}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div ref={daysBox} data-slide={slide} className="-m-1 overflow-hidden p-1">
        {view === "week" ? (
          <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
            {week.map((d) => {
              const id = iso(d);
              const o = open(id);
              const on = pick.date === id;
              return (
                <button
                  key={id}
                  data-day={id}
                  type="button"
                  disabled={!o.size}
                  aria-pressed={on}
                  aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                  onClick={(e) => {
                    choose(id, pick.min, false);
                    if (e.currentTarget.closest(".tp[data-split]")) { setMstep("times"); showTimes(); }
                  }}
                  className={cn(
                    "flex flex-col gap-2 min-w-0 overflow-hidden rounded-[var(--tp-r,6px)] border-[0.5px] p-[var(--pad)] pb-0 text-left [--pad:0.375rem] @md:[--pad:0.625rem] transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] @xl:[--pad:0.75rem]",
                    on ? "border-foreground bg-foreground text-background" : o.size ? "tp-open hoverable:hover:-translate-y-0.5" : "",
                    // Julian: the square stays round a shut day.
                    !o.size && "pointer-events-none border-border opacity-50",
                  )}
                >
                  <span className="label opacity-70">{DAYS[d.getDay()]}</span>
                  <b className="font-display text-base leading-none @md:text-xl @xl:text-3xl">{d.getDate()}</b>
                  {/* Julian: the day's times fill the foot of the tile, edge to
                      edge, round its corners (2026-10-11). */}
                  <Bars steps={steps} open={o} on={on} className="-mx-[var(--pad)] mt-auto h-5 @md:h-6" />
                </button>
              );
            })}
          </div>
        ) : (
          <div ref={monthGrid} className="@container grid grid-cols-7 gap-2 sm:gap-2.5">
            {/* The grid is the measure: a tile's number, padding and bars
                follow its width (cqw), so the month beside the times keeps
                the week's proportions rather than cropping them. */}
            {DAYS.map((d) => (
              <span key={d} className="label pb-1 text-muted-foreground">{d[0]}<span className="@max-[22rem]:hidden">{d.slice(1)}</span></span>
            ))}
            {month.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const id = iso(d);
              const o = open(id);
              const on = pick.date === id;
              return (
                <button
                  key={id}
                  data-day={id}
                  type="button"
                  disabled={!o.size}
                  aria-pressed={on}
                  aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                  onClick={() => { choose(id, pick.min, false); setMstep("times"); showTimes(); }}
                  className={cn(
                    "flex aspect-[1/0.9] max-h-[4.5rem] w-full min-w-0 flex-col justify-between gap-1 overflow-hidden rounded-[var(--tp-r,6px)] border-[0.5px] p-[var(--pad)] pb-0 text-left [--pad:min(0.75rem,1.6cqw,calc(var(--cell-h,99rem)*0.14))] tp-short:aspect-auto transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] h-[var(--cell-h,auto)]",
                    on ? "border-foreground bg-foreground text-background" : o.size ? "tp-open hoverable:hover:-translate-y-0.5" : "",
                    !o.size && "pointer-events-none border-border opacity-50",
                  )}
                >
                  {/* The number follows the cell: when a short card squeezes the
                      month (`--cell-h`), it shrinks with it rather than
                      spilling out (Julian, 2026-10-11). */}
                  <b className="font-display text-[min(1.875rem,5cqw,calc(var(--cell-h,99rem)*0.42))] leading-none">{d.getDate()}</b>
                  <Bars steps={steps} open={o} on={on} className="-mx-[var(--pad)] h-[min(1.25rem,2.8cqw,calc(var(--cell-h,99rem)*0.3))] shrink-0" />
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* the time. Not under a month: the picked button says it, and a
          six-row month on an iPad or a phone had no room for both. */}
      {/* Julian: the big day and time too close to the days and to 02. Spare
          height splits over it and under it, up to 3rem a side. */}
      {view === "week" ? <div aria-hidden className="shrink-0 grow basis-0" style={{ maxHeight: "3rem" }} /> : null}
      {view === "week" ? (
      <div className="flex flex-col gap-0.5 pt-10 sm:pt-[var(--tp-top,2.5rem)] tp-short:pt-3 tp-short:gap-0">
        {/* The day over its time, or what to do before one is picked. */}
        <p key={chosen ? pick.date : "none"} className={cn("tp-roll font-display text-[clamp(1.25rem,4.5cqw,var(--tp-day,2.25rem))] uppercase leading-none tracking-[-0.02em]", !chosen && "text-muted-foreground")}>
          {chosen ? `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}` : "Pick a day, then a time"}
        </p>
        <div className="flex items-baseline gap-3">
        <div ref={big} aria-hidden className={cn("font-display flex tabular-nums tracking-[-0.05em] transition-opacity duration-300 mt-[var(--tp-day-gap,0.15em)] text-[clamp(3.5rem,min(22cqw,14vh),var(--tp-time,9rem))] tp-short:text-[clamp(3rem,10cqw,5rem)] leading-[0.85]", chosen !== "time" && "opacity-25")}>
          {[...t].map((c, i) => (
            <span key={`${i}${c}`} className="tp-roll inline-block">{c}</span>
          ))}
        </div>
        <span className="label">{ap}</span>
        <span className="label ml-auto shrink-0 whitespace-nowrap text-right text-muted-foreground">Until<br />{until} {clock(pick.min + length)[1]}</span>
      </div>
      </div>
      ) : null}

      {/* the gap dial is tuned for the week; a month keeps 1.25rem. Julian:
          "lower". The dial is the least; spare height adds up to 3rem. */}
      {view === "week" ? <div aria-hidden className="shrink-0 grow basis-0" style={{ minHeight: "var(--tp-gap, 2rem)", maxHeight: "calc(var(--tp-gap, 2rem) + 3rem)" }} /> : null}

      {/* the times: the open ones of the day picked, as buttons */}
      <div ref={slotsBox} data-part="times" className={cn("flex flex-col gap-4 pb-6 tp-short:gap-2", view === "month" && "mt-5 tp-short:mt-2")}>
        {/* Back to the month or the week, in the split's times step only (contact.css). */}
        <button type="button" data-part="back" onClick={() => setMstep("days")} className="tap-44 label flex items-center gap-3 self-start text-foreground transition-opacity duration-200 hoverable:hover:opacity-60">
          {arrow}
          {view === "month" ? MONTHS[anchor.getMonth()] : "Week"}
        </button>
        <p className="label text-muted-foreground"><span className="mr-3 text-foreground">02</span>Pick a time
          {/* Under a month there is no day over the times to say whose they
              are, and the month shown may not hold it (Julian). */}
          {view === "month" ? <span className="ml-3 text-foreground">{WEEKDAYS[date.getDay()].slice(0, 3)}, {MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}</span> : null}
        </p>
        {/* Julian: the times in kinds, morning, afternoon and evening, side
            by side on one line the width of the picker, each named over its
            own and as wide as its share of the times. No AM or PM in the
            boxes: the kind says it. When a box would be under 4.25rem (a day
            of half hours, a phone), a kind to a line, named to its left past a
            phone, the boxes on one grid so they line up from kind to kind. */}
        {(() => {
        const kinds = PARTS.map(([part, from, to]) => [part, (days[pick.date] ?? []).filter((x) => minutesOf(x.start) >= from && minutesOf(x.start) < to)] as const).filter(([, list]) => list.length);
        const n = kinds.reduce((t, [, list]) => t + list.length, 0);
        const line = n * 68 + (n - kinds.length) * 6 + (kinds.length - 1) * 24 <= slotsW;
        /* Stacked, the rows are even: ten afternoon times went seven and
           an orphaned three. As many columns as fit at 5rem, then fewer,
           so the longest kind splits evenly (five and five), and every
           kind shares them so the boxes line up. Past a phone the names
           take 6.5rem and a 1rem gap at the left (the @md rail). */
        const room = slotsW >= 448 ? slotsW - 120 : slotsW;
        const most = Math.max(1, ...kinds.map(([, list]) => list.length));
        const fit = Math.max(1, Math.floor((room + 6) / (slotsW >= 448 ? 76 : 86)));
        const cols = Math.min(fit, Math.ceil(most / Math.ceil(most / fit)));
        return (
        <div key={pick.date} className={cn("flex gap-x-6 gap-y-3 tp-short:gap-y-3", !line && "flex-col")}>
        {kinds.map(([part, list]) => (
          <div key={part} className={cn("flex min-w-0 flex-col gap-2 tp-short:gap-1", line ? "basis-0" : "@md:grid @md:grid-cols-[6.5rem_minmax(0,1fr)] @md:items-baseline @md:gap-x-4")} style={line ? { flexGrow: list.length } : undefined}>
          <span className="label text-muted-foreground">{part}</span>
          <div className={line ? "flex gap-1.5" : "grid gap-1.5"} style={line ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {list.map((x) => {
            const n = (days[pick.date] ?? []).indexOf(x);
            const m = minutesOf(x.start);
            const on = chosen === "time" && m === pick.min;
            const [h, a] = clock(m);
            return (
              <button
                key={x.start}
                data-slot=""
                type="button"
                aria-pressed={on}
                aria-label={`${h} ${a}`}
                onClick={() => choose(pick.date, m, true)}
                style={{ animationDelay: `${n * 25}ms` }}
                className={cn(
                  "tp-rise label min-w-0 flex-1 rounded-[var(--tp-r,6px)] [animation-fill-mode:backwards] border-[0.5px] py-[min(var(--tp-slot,0.75rem),0.625rem)] text-center sm:py-[var(--tp-slot,0.75rem)] tabular-nums transition-[background-color,color,translate] duration-300 ease-[var(--ease-out-strong)] tp-short:py-2",
                  on ? "border-foreground bg-foreground text-background" : "tp-open hoverable:hover:-translate-y-0.5",
                  // A day of one or two times: a box, not a bar the width of
                  // the card.
                  line && "max-w-[9rem]",
                  // A crowded day: shorter boxes, or the evening fell under
                  // the bar (an iPad held sideways; a week of half-hour calls
                  // at 1547x889).
                  !line && "py-2 sm:py-2 tp-short:py-1.5",
                )}
              >
                {h}
              </button>
            );
          })}
          </div>
          </div>
        ))}
        </div>
        );
        })()}
      </div>
      </Fold>

      {/* confirm */}
      {step === "pick" ? (
        <div className="sticky bottom-0 z-10 mt-auto flex flex-col gap-4 pt-6 bg-background/80 backdrop-blur-md tp-short:pb-1 tp-short:pt-4 @md:flex-row @md:items-center @md:justify-between">
          <span className="label text-muted-foreground">{chosen === "time" ? `${sum} ${zone(pick.start, tz)}` : `San Jose, CA · ${here}${tz === "America/Los_Angeles" ? "" : ` · times in ${zone(pick.start, tz)}`}`}</span>
          <button type="button" data-part="act" onClick={() => setOk("spin")} disabled={chosen !== "time"} aria-busy={!!ok} className="label relative rounded-[2px] border border-foreground bg-foreground px-6 @max-md:w-full py-4 text-background transition-[opacity,scale,background-color,border-color,color] duration-300 enabled:border-accent enabled:bg-accent enabled:text-accent-foreground hoverable:hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35">
            <span className={cn("transition-opacity duration-200", ok && "opacity-0")}>Confirm this time</span>
            {ok ? (
              <span aria-hidden className="tp-status absolute inset-0 m-auto size-6" data-ok={ok === "tick" ? "" : undefined}>
                {[["1.1s", 6, 1], ["1.6s", 4.5, 0.7], ["0.9s", 3.5, 0.5]].map(([d, size, o], n) => (
                  <span key={n} className="tp-arm absolute inset-0" style={{ animationDuration: d as string, animationDirection: n % 2 ? "reverse" : "normal" }}>
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-current" style={{ width: size, height: size, opacity: o }} />
                  </span>
                ))}
                <svg viewBox="0 0 112 112" className="absolute inset-0 size-full" fill="none">
                  <path className="tp-tick" d="M30 58l18 18 34-38" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: "0.15s", strokeDasharray: 80, strokeDashoffset: 80 }} />
                </svg>
              </span>
            ) : null}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void book(new FormData(e.currentTarget));
          }}
          className="tp-rise flex flex-col gap-4"
        >
          <div data-part="when" className="flex items-center justify-between gap-4">
            <span className="label">{sum}</span>
            <button type="button" onClick={() => setStep("pick")} className="label text-muted-foreground hoverable:hover:text-foreground">Change</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label flex flex-col gap-2 text-muted-foreground">First name *<input name="first" required autoComplete="given-name" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
            <label className="label flex flex-col gap-2 text-muted-foreground">Last name *<input name="last" required autoComplete="family-name" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
            <label className="label flex flex-col gap-2 text-muted-foreground">Email *<input name="email" type="email" required autoComplete="email" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
            <label className="label flex flex-col gap-2 text-muted-foreground">Phone *<input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
            {needsWhere && WHERE[slug]?.length === 1 ? null : needsWhere && WHERE[slug] ? (
              <>
                <fieldset className="flex flex-col sm:col-span-2">
                  <legend className="label mb-2 text-muted-foreground">Location *</legend>
                  <div className="flex flex-wrap gap-2">
                    {WHERE[slug].map(([label]) => (
                      <label key={label} className="label cursor-pointer">
                        <input type="radio" name="opt" value={label} required checked={opt === label} onChange={() => {
                          setOpt(label);
                          const next = WHERE[slug].find(([l]) => l === label)?.[1];
                          if (next) setAsk(next);
                        }} className="peer sr-only" />
                        <span data-part="chip" className="block rounded-[2px] border border-border px-5 py-3 transition-colors duration-200 hoverable:hover:border-foreground peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">{label}</span>
                      </label>
                    ))}
                  </div>
                  <Fold on={!!WHERE[slug].find(([label]) => label === opt)?.[1]}>
                    <label className="label flex flex-col gap-2 pt-4 text-muted-foreground">{ask}<input name="detail" required={!!WHERE[slug].find(([label]) => label === opt)?.[1]} className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
                  </Fold>
                </fieldset>
              </>
            ) : needsWhere ? (
              <label className="label flex flex-col gap-2 text-muted-foreground sm:col-span-2">Where: the studio, or an address?<input name="where" required className="border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
            ) : null}
          </div>
          
          <label className="label flex flex-col gap-2 text-muted-foreground">Anything I should know<textarea name="notes" rows={2} placeholder="Optional" className="resize-none placeholder:uppercase placeholder:text-muted-foreground/50 border-b border-border bg-transparent py-2 text-base normal-case text-foreground outline-none focus:border-foreground" /></label>
          {error ? <p role="alert" className="text-sm normal-case text-foreground">{error}</p> : null}
          <button type="submit" data-part="act" disabled={step === "sending"} className="label self-end rounded-[2px] border border-foreground bg-foreground px-6 py-4 text-background transition-[opacity,scale] duration-300 hoverable:hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
            {step === "sending" ? "Booking" : "Book it"}
          </button>
        </form>
      )}
    </div>
  );
}
