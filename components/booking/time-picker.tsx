"use client";

import * as React from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import type { DepositBody } from "@/components/booking/deposit-step";
import { isPaid } from "@/lib/booking/paid";
import { Orb, ORB_ROUND } from "@/components/orb";
import { JgLoad } from "@/components/splash/jg-load";
import { TZ } from "@/lib/booking/booking-rules";
import { mplan } from "@/lib/mplan";
import { AHEAD, DAYS, e164, fromIso, iso, KEEP, minutesOf, MONTHS, noop, overflowOf, recent, WHERE, clock, type Pick, type Slot, type Step, type V3Book } from "@/components/booking/time-picker-parts";
import { V3Steps } from "@/components/booking/time-picker-v3";
import { EditorialCard } from "@/components/booking/time-picker-editorial";
import { ClassicCard } from "@/components/booking/time-picker-classic";

export type { V3Book };

/* Goo (Julian, 2026-10-20, OKd 10-21) on the card's buttons, times and
   open days. `?goo=0` turns it off: `goo()` in deposit-step.tsx. */

/* ── the time picker ──────────────────────────────────────────────
 * The open times, in two plain steps: a day, then a time. Days
 * are cards (a week, or the month) with how open each is; the open times
 * of the day picked are buttons, and the one picked is the large number.
 * Julian: the ruler of ticks was too minimal to read at a glance.
 *
 * It reads and books through the site's own engine (`/api/slots`,
 * `/api/book`). If the times do not come, `fallback` is shown: Try again,
 * Inquire and the address (`components/booking/cal-embed.tsx`).
 * ─────────────────────────────────────────────────────────────── */

type Props = {
  /** "username/event-slug" */
  path: string;
  title: string;
  className?: string;
  fallback: React.ReactNode;
  /** JG V3: the booking as the master's stepper, inside the page's shell. */
  v3?: V3Book;
  /** A time picked and confirmed: handed here instead of opening the form (a reschedule). */
  onPicked?: (start: string) => void;
};

/* The picker's state, times and motion; the cards below only draw it. */
function usePicker({ path, title, className, fallback, v3, onPicked }: Props) {
  const [username, slug] = path.split("/");
  const [tz] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || TZ);
  /* Julian: the time where I am, with the place, before a time is picked. */
  const clockHere = () => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date());
  const [here, setHere] = React.useState(clockHere);
  React.useEffect(() => {
    const t = setInterval(() => setHere(clockHere()), 15000);
    return () => clearInterval(t);
  }, []);
  const [length, setLength] = React.useState(30);
  /** The event takes its place from the visitor (a studio session or their own address). */
  const [needsWhere, setNeedsWhere] = React.useState(false);
  const [opt, setOpt] = React.useState("");
  /* A call, editorial: by video (its Meet link) or phone, I ring them. */
  const [via, setVia] = React.useState<"Video" | "Phone">("Video");
  /** The follow-up question, kept while it folds shut so its text does not vanish first. */
  const [ask, setAsk] = React.useState("");
  const [session, setSession] = React.useState("");
  /** Who booked, for the page that follows. */
  /* `via`: a call taken by video (its Google Meet link) or by phone. */
  const [booked, setBooked] = React.useState({ name: "", email: "", where: "", phone: "", via: "" });
  const [days, setDays] = React.useState<Record<string, Slot[]> | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "fallback">("loading");
  /* Julian (2026-10-14): the orb goes one whole round before the days
     come in, however fast the times arrive (`ORB_ROUND`, orb.tsx). */
  /* The picker is not drawn while held: the effects that measure it
     re-run on `held`, or they ran on nothing and the week never fitted. */
  const [held, setHeld] = React.useState(true);
  /* J and G fill while the times load (jg-load.tsx) and let go of the
     picker themselves; `?loader=orb` keeps the orb and its round. */
  const [orb, setOrb] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrb(new URLSearchParams(window.location.search).get("loader") === "orb");
  }, []);
  React.useEffect(() => {
    if (!orb) return;
    const t = window.setTimeout(() => setHeld(false), ORB_ROUND.composing);
    return () => window.clearTimeout(t);
  }, [orb]);
  const jg = <JgLoad done={state === "ready" && !!days} onDone={() => setHeld(false)} className="min-h-[16rem] w-full" />;
  // The editorial card opens on its month (2026-10-20); `?classic` keeps the week.
  const [view, setView] = React.useState<"week" | "month">(() => (typeof location !== "undefined" && new URLSearchParams(location.search).has("classic") ? "week" : "month"));
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
  const [step, setStep] = React.useState<Step>("pick");
  /* Option B's row of times (v3): where a swipe on the big number began, and
     whether the row runs past its edge, which fades it and shows the hint. */
  const swipeX = React.useRef<number | null>(null);
  const wheelGate = React.useRef({ at: -Infinity, owned: false });
  const [stripEl, stripRef] = React.useState<HTMLDivElement | null>(null);
  const [more, setMore] = React.useState(false);
  /* A paid session, its deposit taken here (`?deposit`, deposit-step.tsx). */
  const [paid, setPaid] = React.useState(false);
  const [deposit, setDeposit] = React.useState<DepositBody | null>(null);
  /* JG V3: references picked on the details step, sent with the deposit (Julian, 2026-10-28). */
  const [refs, setRefs] = React.useState<FormData | null>(null);
  /* What was typed, put back when the deposit step goes back to the form. */
  const typed = React.useRef<Record<string, string>>({});
  /* `?smooth`, while Julian looks: each step slides in from the side it
     comes from (GSAP), the big time rolls to a new pick, and the booked
     card turns teal. */
  const smooth = React.useSyncExternalStore(noop, () => new URLSearchParams(location.search).has("smooth"), () => false);
  React.useEffect(() => {
    if (smooth) document.documentElement.dataset.smooth = "";
  }, [smooth]);
  /* The card as a magazine page (editorial.css, booking-editorial-mock.html),
     everywhere since 2026-10-17 (Julian: "make sure the new card design is
     out"). The card before it stays behind `?classic`. */
  const editorial = React.useSyncExternalStore(noop, () => !new URLSearchParams(location.search).has("classic"), () => true);
  React.useEffect(() => {
    if (!editorial) document.documentElement.dataset.classic = "";
  }, [editorial]);
  const root = React.useRef<HTMLDivElement>(null);
  const v3root = React.useRef<HTMLDivElement>(null); // the V3 stepper's own, so root's slide motion stays editorial-card only
  const was = React.useRef(step);
  React.useLayoutEffect(() => {
    const ORDER = { pick: 0, form: 1, sending: 1, check: 1, pay: 2, done: 3 };
    const dir = Math.sign(ORDER[step] - ORDER[was.current]);
    was.current = step;
    const el = root.current;
    // A step opens at its top: on an iPhone Details opened where Continue
    // had been, Name and Email above the screen (JG - MAC, 2026-10-17).
    const card = el?.matches(".ed") ? el : el?.querySelector<HTMLElement>(".ed");
    if (editorial && dir && card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start" });
    // Back to the taller Time step keeps You's scroll too; FlowShell only sees forward steps.
    const rail = v3root.current?.querySelector<HTMLElement>(".rail");
    if (dir < 0 && rail && rail.getBoundingClientRect().top < 64) rail.scrollIntoView({ block: "start" });
    if (!(smooth || editorial) || !dir || !el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (editorial) {
      // Booked rises in; any other step slides in from the side it comes from.
      const up = step === "done";
      gsap.fromTo(
        el.querySelectorAll(".ed-l > *, .ed-r > *, .ed-floor"),
        { autoAlpha: 0, x: up ? 0 : 28 * dir, y: up ? 14 : 0 },
        { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.035, clearProps: "opacity,visibility,transform" },
      );
      return;
    }
    if (step === "pick") return;
    const box = step === "form" ? el.querySelector("form") : step === "pay" ? el.firstElementChild : el;
    if (!box?.children.length) return;
    gsap.fromTo(
      box.children,
      { autoAlpha: 0, x: 32 * dir, filter: "blur(6px)" },
      { autoAlpha: 1, x: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out", stagger: 0.04, clearProps: "opacity,visibility,transform,filter" },
    );
  }, [step, smooth, editorial]);
  const [error, setError] = React.useState("");
  /* JG V3: a field's one sentence (master `check()`). */
  const [bad, setBad] = React.useState<Record<string, string>>({});
  // Which errored fields were empty when checked: their error shows as the placeholder (v3 `Field`, flow.tsx).
  const [blank, setBlank] = React.useState<Record<string, boolean>>({});
  /* Julian: Confirm's words turn into the orbs, then a check, before the
     form opens. */
  const [ok, setOk] = React.useState<"" | "spin" | "tick">("");
  /* A reschedule takes the time here; read at the tick, so a parent drawn again never restarts it. */
  const handOff = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    handOff.current = onPicked && pick ? () => onPicked(new Date(pick.start).toISOString()) : null;
  });
  /* Nothing is waited on here, so the orbs and the check in 1.05s
     (Julian, 2026-10-14: 1.4s was slow, 0.7s too fast). */
  React.useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => {
      if (ok === "spin") return setOk("tick");
      setOk("");
      if (handOff.current) handOff.current();
      else setStep("form");
    }, ok === "spin" ? 450 : 600);
    return () => window.clearTimeout(t);
  }, [ok]);

  const load = React.useCallback(async (fresh = false) => {
    const key = `${username}/${slug}/${tz}`;
    try {
      const from = new Date();
      const to = new Date(Date.now() + AHEAD * 864e5);
      // No answer at all left "Loading times" up for good: past
      // 8 seconds the fallback takes over, as for any other failure.
      const signal = AbortSignal.timeout?.(8000);
      const hit = recent.get(key);
      // The event and its times in one (`app/api/slots`).
      const got = !fresh && hit && Date.now() - hit.at < KEEP ? hit.got : fetch(`/api/slots?slug=${slug}&start=${iso(from)}&end=${iso(to)}&timeZone=${encodeURIComponent(tz)}`, { signal })
        .then((r) => r.json())
        .then((j) => [{ data: j.event }, j] as [unknown, unknown]);
      if (got !== hit?.got) recent.set(key, { at: Date.now(), got });
      const [meta, slots] = await got;
      const ev = Array.isArray(meta.data) ? meta.data[0] : meta.data;
      if (!ev || slots.status !== "success") throw new Error("no times");
      // A paid event's deposit is taken here (deposit-step.tsx) where the
      // build has Stripe's key; without it, the fallback.
      // Paid by the site's list (lib/booking/paid.ts).
      const owes = isPaid(slug) || (ev.price ?? 0) > 0;
      if (ev.requiresConfirmation || (owes && !process.env.NEXT_PUBLIC_STRIPE_PK)) {
        setState("fallback");
        return;
      }
      setPaid(owes);
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
  const swipe = React.useRef<{ x: number; y: number; done: boolean; drag?: boolean; v?: number; t?: number; lx?: number } | null>(null);
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
  const flip = React.useRef<{ at: Map<string, DOMRect>; h: number; card: number } | null>(null);
  /* Where a month and a day's times do not fit together (`data-split`,
     below): the month, then the day's times in its place. Julian, no
     scroll in the card, ever (2026-10-11). */
  const [mstep, setMstep] = React.useState<"days" | "times">("days");
  const switchView = (v: "week" | "month") => {
    if (v === view) return;
    setSlide(0);
    setMstep("days");
    const box = daysBox.current;
    // Editorial: the new view is drawn in place, no flip.
    if (box && !editorial) {
      const at = new Map<string, DOMRect>();
      for (const b of box.querySelectorAll<HTMLElement>("[data-day]")) at.set(b.dataset.day!, b.getBoundingClientRect());
      flip.current = { at, h: box.offsetHeight, card: box.closest<HTMLElement>("#book-card")?.offsetHeight ?? 0 };
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
  /* The time picked kept in view in option B's row, and the fade and hint
     only while times run past its edge. */
  React.useEffect(() => {
    // The row mounts after the times arrive (a state ref, not useRef, so this runs then).
    const ix = stripEl;
    if (!ix) return;
    const on = ix.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (on && (on.offsetLeft < ix.scrollLeft || on.offsetLeft + on.offsetWidth > ix.scrollLeft + ix.clientWidth)) ix.scrollTo({ left: Math.max(0, on.offsetLeft - on.offsetWidth) });
    const fit = () => setMore(ix.scrollLeft + ix.clientWidth < ix.scrollWidth - 4);
    fit();
    // The row's own box keeps its width as the times grow or the fonts land: watch the buttons too.
    const ro = new ResizeObserver(fit);
    ro.observe(ix);
    for (const b of ix.children) ro.observe(b);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [stripEl, pick?.date, pick?.min, days, step]);
  const slotsBox = React.useRef<HTMLDivElement>(null);
  /* `?layout`: the times come in with GSAP, each one once. The CSS rise
     replayed whenever the list re-rendered, and read as a glitch (Julian). */
  const [gs] = React.useState(() => typeof location !== "undefined" && new URLSearchParams(location.search).has("layout"));
  const seen = React.useRef(new WeakSet<Element>());
  const [slotsW, setSlotsW] = React.useState(0);
  /* Watched by whichever box is drawn now: one replaced under the old
     observer read 0 as it left, and the times stacked one to a line under
     Confirm (Julian, 2026-10-16). Hidden (0) keeps the last width. */
  const slotsRO = React.useRef<ResizeObserver | null>(null);
  const slotsRef = React.useCallback((el: HTMLDivElement | null) => {
    slotsRO.current?.disconnect();
    slotsBox.current = el;
    if (!el) return;
    slotsRO.current = new ResizeObserver(() => el.clientWidth && setSlotsW(el.clientWidth));
    slotsRO.current.observe(el);
  }, []);
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
      // Still over on a short window (a phone on its side, a laptop or an
      // iPad at 600 tall, where the times ran under Confirm): the week, then
      // the day's times in its place, as a month that does not fit
      // (`data-split`). Not on a tall one: /book at 1440x900 is over too
      // before a day is picked, and split there it lost its Confirm bar
      // (CI on #134).
      if (overflowOf(tp) > 0 && matchMedia("(max-height: 40rem) and (min-width: 40rem)").matches) tp.setAttribute("data-split", "");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(tp);
    /* Back from the form (Change) the steps slide open (grid rows) and it
       was measured mid-slide, saw room, and kept the big time full height
       over the times: fitted again when the slide lands (Julian). */
    const landed = (e: TransitionEvent) => e.propertyName === "grid-template-rows" && fit();
    tp.addEventListener("transitionend", landed);
    return () => {
      ro.disconnect();
      tp.removeEventListener("transitionend", landed);
      tp.removeAttribute("data-tight");
      tp.removeAttribute("data-split");
    };
  }, [view, pick?.date, days, slotsW, mstep, held]);
  React.useLayoutEffect(() => {
    if (!gs || !slotsBox.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fresh = [...slotsBox.current.querySelectorAll("[data-slot]")].filter((b) => !seen.current.has(b));
    if (!fresh.length) return;
    fresh.forEach((b) => seen.current.add(b));
    gsap.fromTo(fresh, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.025, clearProps: "opacity,visibility,transform" });
  });
  const at = pick?.start;
  const lastPick = React.useRef(at);
  React.useLayoutEffect(() => {
    const from = lastPick.current;
    lastPick.current = at;
    if (!smooth || !from || !at || from === at || !big.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dir = +new Date(at) > +new Date(from) ? 1 : -1;
    gsap.fromTo(big.current, { yPercent: 18 * dir, filter: "blur(4px)" }, { yPercent: 0, filter: "blur(0px)", duration: 0.45, ease: "expo.out", clearProps: "transform,filter" });
  }, [at, smooth]);
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
      /* Not while the days glide to the month (below): the box they sit in
         is short until it lands and its hidden overflow squeezed the cells
         to nothing. Fitted again when it lands (`refit`). */
      if (daysBox.current?.getAnimations().length) return;
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
  }, [view, month, pick?.date, days, mstep, held]);
  React.useLayoutEffect(() => {
    const f = flip.current;
    flip.current = null;
    const box = daysBox.current;
    if (!f || !box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ms = 520;
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    // Measured again once the box is at its height: until then it hides what overflows.
    /* And the card round it, on a phone where it grows with what it holds,
       from its height before the switch, measured before the days start
       their glide. Left to its own ease (`easeHeight`) it was measured
       after the big time and the week row had gone, and snapped shorter
       for a frame before it grew (QA, on an iPhone, Week to Month). */
    const card = f.card ? box.closest<HTMLElement>("#book-card") : null;
    const to = card?.offsetHeight ?? 0;
    box.animate([{ height: `${f.h}px` }, { height: `${box.offsetHeight}px` }], { duration: ms, easing }).finished.then(() => refit.current(), () => {});
    if (card && Math.abs(to - f.card) > 1) card.animate([{ height: `${f.card}px` }, { height: `${to}px` }], { duration: ms, easing });
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
  /* Editorial: the card never scrolls. Over by anything, it closes up a
     step at a time (`data-fit`, editorial.css): a smaller time, no big
     time, then the days and the times as two screens. */
  React.useLayoutEffect(() => {
    const el = root.current;
    const body = el?.querySelector<HTMLElement>(".ed-body");
    if (!editorial || step !== "pick" || !el || !body) return;
    const fit = () => {
      el.removeAttribute("data-scroll");
      /* Measured two ways: WebKit reported no scroll while the month's
         last week sat under the floor (MAC on #279, 2026-10-21), so the
         month's own bottom is checked against the body's as well. */
      const over = () => {
        const month = body.querySelector(".ed-month, .ed-days");
        const past = month ? month.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom : 0;
        return Math.max(body.scrollHeight - body.clientHeight, past);
      };
      el.style.removeProperty("--ed-cell");
      for (let n = 0; n <= 3; n++) {
        el.dataset.fit = String(n);
        if (over() <= 1) {
          /* A wide card with room to spare (Julian, 2026-10-21): the
             month's cells grow into it, a quarter rem at a time. */
          if (n === 0 && view === "month" && el.clientWidth >= 640) {
            let kept = 3.125;
            for (let r = 3.375; r <= 5.5; r += 0.25) {
              el.style.setProperty("--ed-cell", r + "rem");
              if (over() > 1) break;
              kept = r;
            }
            el.style.setProperty("--ed-cell", kept + "rem");
          }
          return;
        }
      }
      // Still over at the last step (a phone on its side, QA on #204): the
      // days were clipped out of reach. Reachable beats no scroll.
      el.dataset.scroll = "";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editorial, step, view, month, week, pick?.date, chosen, days, mstep, held]);
  /* Split in two and scrolling, each screen opens at its top: the times
     opened where the days had been scrolled to, their way back hidden. */
  React.useLayoutEffect(() => {
    const body = root.current?.querySelector<HTMLElement>(".ed-body");
    if (editorial && body) body.scrollTop = 0;
  }, [editorial, mstep]);
  /* Editorial: the days cascade in, left to right across a week, a ripple from the top left of a month
     (Julian, 2026-10-16). On every week or month shown, but not the first:
     once the orb goes the card is there whole (Julian, 2026-10-20). */
  const first = React.useRef(false);
  const shown = view === "week" ? `w${iso(week[0])}` : `m${anchor.getFullYear()}-${anchor.getMonth()}`;
  React.useLayoutEffect(() => {
    const box = daysBox.current;
    if (!editorial || step !== "pick" || !box || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!first.current) return void (first.current = true);
    const cells = [...box.querySelectorAll<HTMLElement>(".ed-day, .ed-cell, .ed-blank")];
    const at = (k: number) => (view === "week" ? k * 0.06 : (k % 7) * 0.03 + Math.floor(k / 7) * 0.06);
    const tw = cells.map((c, k) =>
      gsap.fromTo(c, { autoAlpha: 0, y: 10, rotationX: -35, transformPerspective: 500, transformOrigin: "50% 0%" }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.45, delay: at(k), ease: "expo.out", clearProps: "opacity,visibility,transform" }),
    );
    return () => tw.forEach((t) => t.progress(1).kill());
  }, [editorial, step, shown, view, held, state]);
  /* The swipe nudge (Julian, 2026-10-17, on for everyone): on a touch
     screen the week eases 8px left and back after the cascade, no
     bounce (Julian: the 16px spring was too much), so the strip reads as
     something that swipes. Once a visit. */
  React.useEffect(() => {
    const row = daysBox.current?.firstElementChild as HTMLElement | null;
    if (!editorial || step !== "pick" || view !== "week" || !row) return;
    if (!matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { if (sessionStorage.getItem("ed-nudged")) return; } catch {}
    const seen = () => { try { sessionStorage.setItem("ed-nudged", "1"); } catch {} };
    let tl: gsap.core.Timeline | undefined;
    const play = () => { tl = gsap.timeline({ delay: 1.1, onStart: seen }).to(row, { x: -8, duration: 0.4, ease: "power2.out" }).to(row, { x: 0, duration: 0.5, ease: "power2.inOut" }); };
    /* Not behind the opening splash (MAC, real iOS): the delay starts once it has lifted. */
    const root = document.documentElement;
    const watch = new MutationObserver(() => { if (!root.hasAttribute("data-intro")) { watch.disconnect(); play(); } });
    if (root.hasAttribute("data-intro")) watch.observe(root, { attributes: true, attributeFilter: ["data-intro"] });
    else play();
    /* Undone without spending the visit's nudge: it only counts once it has really started. */
    return () => {
      watch.disconnect();
      if (!tl) return;
      const begun = tl.progress() > 0;
      tl.kill();
      if (begun) gsap.set(row, { x: 0 });
    };
  }, [editorial, step, view, held, state]);
  /* Nothing to go back to before today. */
  const atStart = view === "week" ? +week[0] <= +today : anchor.getFullYear() * 12 + anchor.getMonth() <= today.getFullYear() * 12 + today.getMonth();

  const book = async (form: FormData) => {
    if (!pick) return;
    typed.current = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
    setStep("sending");
    setError("");
    const began = Date.now();
    const opts = WHERE[slug];
    const picked = opts?.length === 1 ? opts[0][0] : String(form.get("opt") || "");
    const asked = opts?.find(([label]) => label === picked)?.[1];
    const where = opts ? [picked, asked ? String(form.get("detail") || "").trim() : ""].filter(Boolean).join(": ") : String(form.get("where") || "").trim();
    const raw = String(form.get("phone") || "").trim();
    const phone = e164(raw);
    // JG V3: the phone is optional; one typed has to be a number.
    if (!phone && (!v3 || raw)) {
      setError("Check your phone number. Add the country code if it is not a US number.");
      setStep("form");
      return;
    }
    const notes = String(form.get("notes") || "").trim();
    // JG V3 asks one Name; the classic and editorial cards ask first and last.
    const name = String(form.get("name") ?? `${String(form.get("first")).trim()} ${String(form.get("last")).trim()}`).trim();
    const firstName = name.split(/\s+/)[0];
    if (paid) {
      setBooked({ name: firstName, email: String(form.get("email")).trim(), where, phone, via: "" });
      setDeposit({ engine: "own", slug, start: new Date(pick.start).toISOString(), timeZone: tz, name, email: String(form.get("email")), phone, ...(notes ? { notes } : {}), ...(needsWhere ? { where } : {}), session });
      const sent = new FormData();
      form.getAll("refs").forEach((f) => f instanceof File && f.size && sent.append("refs", f));
      if (form.get("picks")) sent.append("picks", String(form.get("picks")));
      setRefs(sent.has("refs") || sent.has("picks") ? sent : null);
      setStep("pay");
      return;
    }
    // A call (editorial): by video on its Meet link, or I ring the number.
    const via = String(form.get("via") || "");
    /* Development only: `?sim=ok` books nothing, to see the page after. */
    const sim = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).get("sim") === "ok";
    try {
      if (!sim) {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: "own", slug, start: new Date(pick.start).toISOString(), timeZone: tz, name, email: String(form.get("email")), phone, via, ...(notes ? { notes } : {}), ...(needsWhere ? { where } : {}) }),
      });
      const body = await res.json();
      // 409 is the engine saying the slot went to someone else.
      if (!res.ok || body.status !== "success") throw Object.assign(new Error(body?.error?.message || "failed"), { status: res.status });
      }
      setBooked({ name: firstName, email: String(form.get("email")).trim(), where, phone, via });
      /* The orbs get their moment even when the server answers at once, then
         turn into the check, which is shown before the page that follows. */
      // JG V3 draws no orb, so it has no moment to wait for.
      if (!v3) {
        await new Promise((go) => setTimeout(go, Math.max(0, ORB_ROUND.solving - (Date.now() - began))));
        setStep("check");
        await new Promise((go) => setTimeout(go, 1500));
      }
      // The time is taken now: the next picker asks again.
      recent.delete(`${username}/${slug}/${tz}`);
      setStep("done");
    } catch (e) {
      setError((e as { status?: number }).status === 409 ? "That time was just taken. Pick another." : "That did not go through. Try again, or write to hello@juliangigola.com.");
      setStep("form");
      void load(true);
    }
  };

  /* The note: two lines, growing to five with what is typed, then it
     scrolls (Julian, 2026-10-17). */
  const grow = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 24;
    const frame = el.offsetHeight - el.clientHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, line * 5 + frame)}px`;
  };
  /* What was typed, put back in a form drawn again. */
  /* Stable, so a form drawn again for its error lines keeps what is in it. */
  const refill = React.useCallback((f: HTMLFormElement | null) => {
    if (!f) return;
    for (const [k, v] of Object.entries(typed.current)) {
      const el = f.elements.namedItem(k);
      if ((el instanceof HTMLInputElement && el.type !== "radio") || el instanceof HTMLTextAreaElement) el.value = v;
    }
  }, []);
  /* Booking: the orb, then the ring and its check, over the card. */
  const busy = step === "sending" || step === "check" ? (
        <div role="status" aria-live="polite" className="absolute inset-0 z-20 bg-background/85 backdrop-blur-md">
          {/* The orb in the middle of the card, its word under it, out of
              the reckoning (QA on #143); a phone's card taller than the
              screen keeps it in the middle of what shows. */}
          <div className="sticky top-0 flex h-full max-h-[100svh] flex-col items-center justify-center">
            <div className="relative -translate-y-[var(--card-lift,0px)]">
            <div className="tp-status relative size-28" data-ok={step === "check" ? "" : undefined}>
              {/* Julian: the solving orb while it books (2026-10-14, was
                  working); the ring and tick once it is booked. */}
              {step === "sending" ? (
                <span className="absolute inset-0 grid place-items-center text-foreground">
                  <Orb state="solving" size={64} />
                </span>
              ) : null}
              <svg viewBox="0 0 112 112" className="absolute inset-0 size-full" fill="none" aria-hidden>
                <circle className="tp-ring stroke-accent" cx="56" cy="56" r="44" strokeWidth="3" strokeLinecap="round" />
                <path className="tp-tick stroke-accent" d="M38 58l12 12 24-26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="label absolute left-1/2 top-full mt-6 -translate-x-1/2 whitespace-nowrap text-muted-foreground">{step === "check" ? "Booked" : "Booking"}</p>
            </div>
          </div>
        </div>
      ) : null;
  /* Confirm's words turn into the orbs, then a check. */
  const okMark = ok ? (
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
            ) : null;
  /* Julian: a swipe across the days goes to the next or last week or
     month, as the arrows do (both layouts). */
  const swipeProps: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, done: false, v: 0, t: e.timeStamp, lx: e.clientX };
    },
    /* `?smooth`: the days follow the finger once it is clearly
       sideways, give at the start of the calendar, and a flick or
       a third of the row turns the week; less springs back. */
    onPointerMove: (e) => {
      const s = swipe.current, row = daysBox.current?.firstElementChild as HTMLElement | null;
      if (!(smooth || editorial) || !s || !row) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.drag) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        s.drag = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        gsap.killTweensOf(row);
      }
      const dt = e.timeStamp - s.t! || 16;
      s.v = (e.clientX - s.lx!) / dt; // px per ms
      s.t = e.timeStamp;
      s.lx = e.clientX;
      const w = row.offsetWidth;
      const x = atStart && dx > 0 ? (dx * w * 0.55) / (w + 0.55 * dx) : dx;
      gsap.set(row, { x });
    },
    onPointerUp: (e) => {
      const s = swipe.current;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      const row = daysBox.current?.firstElementChild as HTMLElement | null;
      if (s.drag && row) {
        s.done = true;
        const w = row.offsetWidth;
        // Where the flick was going: Apple's projection (0.998), damped to 40%.
        const ahead = dx + (s.v ?? 0) * 499 * 0.4;
        const dir = ahead < -w / 3 ? 1 : ahead > w / 3 && !atStart ? -1 : 0;
        /* MOTION-PLAN.md item 2 (`?mplan=rm`): under Reduce Motion the row
           followed the finger, and on release it snaps; a turned week fades in. */
        if (mplan("rm") && matchMedia("(prefers-reduced-motion: reduce)").matches) {
          gsap.set(row, { clearProps: "transform" });
          if (dir) {
            shift(dir);
            row.animate({ opacity: [0, 1] }, { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
          }
          return;
        }
        if (!dir) return void gsap.to(row, { x: 0, duration: 0.5, ease: "expo.out" });
        gsap.to(row, {
          x: -dir * w,
          autoAlpha: 0,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            shift(dir);
            gsap.set(row, { x: 0, autoAlpha: 1, clearProps: "transform,opacity,visibility" });
          },
        });
        return;
      }
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return void (swipe.current = null);
      s.done = true;
      if (dx < 0) shift(1);
      else if (!atStart) shift(-1);
    },
    onPointerCancel: () => (swipe.current = null),
    // A swipe that ends on the day it began on is not a pick.
    onClickCapture: (e) => {
      if (swipe.current?.done) e.stopPropagation();
      swipe.current = null;
    },
  };
  /* JG V3: the steps around anything that is not the picker itself. */
  const v3paid = paid || isPaid(slug);
  const v3steps = v3paid ? ["Time", "You", "Deposit", "Booked"] : ["Time", "You", "Booked"];
  // The same subtitle as the picker, so nothing below it jumps when the times arrive.
  const v3sub = v3paid ? "Studio in San Jose. I travel across the Bay Area." : "15 minutes, phone or video. Bring your dates and references.";
  /* While the times load the bar is already there, held off: it popped in
     a second after the page on a short screen, where it is the thing at the
     foot of the view (MAC, iPhone Duo folded, 2026-11-08). */
  const heldBar = <button type="button" className="btn fill" disabled>Continue</button>;
  const v3plain = (body: React.ReactNode, bar?: React.ReactNode) => v3!.shell({ steps: v3steps, at: 1, head: v3paid ? "Book a session" : v3!.name === "Consultation" ? "Book a consultation" : "Book a call", sub: v3sub, body, sum: [], bar });
  return { path, title, className, fallback, v3, onPicked, username, slug, tz, clockHere, here, setHere, length, setLength, needsWhere, setNeedsWhere, opt, setOpt, via, setVia, ask, setAsk, session, setSession, booked, setBooked, days, setDays, state, setState, held, setHeld, orb, setOrb, jg, view, setView, anchor, setAnchor, pick, setPick, arrow, chosen, setChosen, step, setStep, swipeX, wheelGate, stripEl, stripRef, more, setMore, paid, setPaid, deposit, setDeposit, refs, setRefs, typed, smooth, editorial, root, v3root, was, error, setError, bad, setBad, blank, setBlank, ok, setOk, handOff, load, lo, hi, open, steps, choose, showTimes, today, week, month, slide, setSlide, swipe, shift, daysBox, flip, mstep, setMstep, switchView, monthGrid, big, slotsBox, gs, seen, slotsW, setSlotsW, slotsRO, slotsRef, at, lastPick, refit, first, shown, atStart, book, grow, refill, busy, okMark, swipeProps, v3paid, v3steps, v3sub, heldBar, v3plain };
}

type Picker = ReturnType<typeof usePicker>;
/** What a card draws from: the picker, with a time on show. */
export type CardCtx = Omit<Picker, "pick" | "days"> & { pick: Pick; days: Record<string, Slot[]>; t: string; ap: string; until: string; date: Date; sum: string; waiting: React.ReactElement };

export function TimePicker(props: Props) {
  const c = usePicker(props);
  const { title, className, fallback, v3, length, days, state, held, orb, jg, pick, editorial, heldBar, v3plain } = c;
  if (state === "fallback") return v3 ? v3plain(fallback) : <>{fallback}</>;
  const waiting = <p role="status" className="lbl mute">Loading availability</p>;
  if (v3 && (state === "loading" || !days || (held && !orb))) return v3plain(orb ? waiting : jg, heldBar);
  if (v3 && !pick) return Object.values(days ?? {}).some((l) => l.length) ? v3plain(waiting, heldBar) : v3plain(<p className="lbl mute">No open times in the next few months. <a href="mailto:hello@juliangigola.com">hello@juliangigola.com</a></p>);
  if (state === "loading" || !days || (held && state === "ready" && !v3)) {
    return (
      // Held to the card's inset and a phone card's height while it waits
      // (the embed's `block` had it on the card's edge, in a sliver).
      <div aria-label={title} className={cn(className, "!flex items-center justify-center px-[var(--card-x,1.25rem)] max-sm:min-h-[24rem]")}>
        {/* Julian: an orb turning, not the words (composing since 2026-10-20; working was picked from
            orb-options 2026-10-14; 64px, at 20 it was lost in the empty card). Still
            said to a reader. */}
        {/* In the middle of the card, not of the room under its top line
            (QA on #143, Julian: the orb in the center of the card): lifted
            half that line (`--card-lift`, book-here.tsx). */}
        {/* Julian (2026-10-14): what it is waiting for, under the orb. */}
        {orb ? (
          <p role="status" className="pointer-events-none absolute inset-0 flex -translate-y-[var(--card-lift,0px)] flex-col items-center justify-center gap-4 text-muted-foreground">
            <Orb state="composing" size={64} />
            <span className="label animate-[jg-fade-in_300ms_ease-out_300ms_both]">Loading availability</span>
          </p>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex -translate-y-[var(--card-lift,0px)] items-center justify-center">{jg}</div>
        )}
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

  const ctx: CardCtx = { ...c, pick, days, t, ap, until, date, sum, waiting };
  /* ── JG V3 (master v39 stepper): Time, You, (Deposit), Booked. The same
     times, booking and deposit as the cards below; only the look is new. */
  if (v3 && editorial) return <V3Steps c={{ ...ctx, v3 }} />;
  if (editorial) return <EditorialCard c={ctx} />;
  return <ClassicCard c={ctx} />;
}
