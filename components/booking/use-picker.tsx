"use client";

import * as React from "react";
import type { DepositBody } from "@/components/booking/deposit-step";
import { isPaid } from "@/lib/booking/paid";
import { ORB_ROUND } from "@/components/effects/orb";
import { JgLoad } from "@/components/splash/jg-load";
import { TZ } from "@/lib/booking/booking-rules";
import { e164, fromIso, minutesOf, noop, forgetTimes, WHERE, type PickedTime, type Slot, type Step, type V3Book } from "@/components/booking/time-picker-parts";
import { byCodeUnit } from "@/lib/utils";
import { clockHere, spanOf } from "@/components/booking/picker-dates";
import { useSlots } from "@/components/booking/use-slots";
import { usePickerDays } from "@/components/booking/use-picker-days";
import { usePickerLayout } from "@/components/booking/use-picker-layout";
import { arrowMark, busyMark, okMarkOf } from "@/components/booking/picker-marks";


/* Goo on the card's buttons, times and
   open days. `?goo=0` turns it off: `goo()` in deposit-step.tsx. */

/* ── the time picker ──────────────────────────────────────────────
 * The open times, in two plain steps: a day, then a time. Days
 * are cards (a week, or the month) with how open each is; the open times
 * of the day picked are buttons, and the one picked is the large number.
 * Julian: the ruler of ticks was too minimal to read at a glance.
 *
 * It reads and books through the site's own engine (`/api/slots`,
 * `/api/book`). If the times do not come, `fallback` is shown: Try again,
 * Inquire and the address (`components/booking/book-times.tsx`).
 * ─────────────────────────────────────────────────────────────── */

export type Props = {
  /** "username/event-slug" */
  path: string;
  title: string;
  className?: string;
  fallback: React.ReactNode;
  /** JG V3: the booking as the master's stepper, inside the page's shell. */
  v3?: V3Book;
  /** A time picked and confirmed: handed here instead of opening the form (a reschedule). */
  onPicked?: (start: string) => void;
  /** The days the card opens on: the month unless asked (the home opens on the week). */
  startView?: "week" | "month";
};

/* The picker's state, times and motion; the cards below only draw it. */
export function usePicker({ path, title, className, fallback, v3, onPicked, startView }: Props) {
  const [username, slug] = path.split("/");
  const [tz] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || TZ);
  const [here, setHere] = React.useState(clockHere);
  React.useEffect(() => {
    const t = setInterval(() => setHere(clockHere()), 15000);
    return () => clearInterval(t);
  }, []);
  const { length, setLength, needsWhere, setNeedsWhere, session, setSession, days, setDays, state, setState, paid, setPaid, load } = useSlots(username, slug, tz);
  const [opt, setOpt] = React.useState("");
  /* A call, editorial: by video (its Meet link) or phone, I ring them. */
  const [via, setVia] = React.useState<"Video" | "Phone">("Video");
  /** The follow-up question, kept while it folds shut so its text does not vanish first. */
  const [ask, setAsk] = React.useState("");
  /** Who booked, for the page that follows. */
  /* `via`: a call taken by video (its Google Meet link) or by phone. */
  const [booked, setBooked] = React.useState({ name: "", email: "", where: "", phone: "", via: "" });
  /* The orb goes one whole round before the days
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
  const { view, setView, anchor, setAnchor, pick, setPick, chosen, setChosen, choose, today, week, month, slide, setSlide, shift, mstep, setMstep, switchView, atStart } = usePickerDays(days, startView);
  const arrow = arrowMark();
  const [step, setStep] = React.useState<Step>("pick");
  /* Option B's row of times (v3): where a swipe on the big number began, and
     whether the row runs past its edge, which fades it and shows the hint. */
  const swipeX = React.useRef<number | null>(null);
  const wheelGate = React.useRef({ at: -Infinity, owned: false });
  const [deposit, setDeposit] = React.useState<DepositBody | null>(null);
  /* JG V3: references picked on the details step, sent with the deposit. */
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
     (owner pick, do not tune). */
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


  React.useEffect(() => {
    void load();
  }, [load]);

  /* The ruler's span, from every open time loaded, to the hour. */
  const { lo, hi } = React.useMemo(() => spanOf(days, length), [days, length]);

  const open = (date: string) => new Set((days?.[date] ?? []).map((s) => minutesOf(s.start)));
  const steps = React.useMemo(() => Array.from({ length: Math.max(1, Math.round((hi - lo) / length)) }, (_, i) => lo + i * length), [lo, hi, length]);

  /* First open day and time, once there are any. */
  React.useEffect(() => {
    if (state !== "ready" || !days || pick) return;
    const date = Object.keys(days).filter((d) => days[d].length).sort(byCodeUnit)[0];
    if (!date) return;
    const s = days[date][0];
    setPick({ date, min: minutesOf(s.start), start: s.start });
    setAnchor(fromIso(date));
  }, [state, days, pick, setPick, setAnchor]);

  /* The time picked went (taken while the form was filled in, and the
     times loaded again): the day stays, the time is to pick again. */
  React.useEffect(() => {
    if (!pick || chosen !== "time" || !days) return;
    if (!days[pick.date]?.some((x) => minutesOf(x.start) === pick.min)) {
      setChosen("day");
    }
  }, [days, pick, chosen, setChosen]);

  const { stripEl, stripRef, more, setMore, root, v3root, was, showTimes, swipe, daysBox, monthGrid, big, slotsBox, gs, seen, slotsW, setSlotsW, slotsRO, slotsRef, at, lastPick, refit, first, shown, swipeProps } = usePickerLayout({ step, pick, days, view, anchor, week, month, chosen, mstep, held, state, smooth, atStart, shift });

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
    // JG V3 asks one Name; the editorial card asks first and last.
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
      const body = (await res.json().catch(() => ({}))) as { status?: string; data?: { uid: string; start: string; end: string; where?: string }; error?: string };
      // 409 is the engine saying the slot went to someone else.
      if (!res.ok || body.status !== "success") throw Object.assign(new Error(body?.error || "failed"), { status: res.status });
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
      forgetTimes(username, slug, tz);
      setStep("done");
    } catch (e) {
      const { status, message } = e as Error & { status?: number };
      // 429 and 503 carry the route's own words ("Too many tries. Wait a minute.", `app/api/book`).
      setError(status === 409 ? "That time was just taken. Pick another." : (status === 429 || status === 503) && message !== "failed" ? message : "That did not go through. Try again, or write to hello@juliangigola.com.");
      setStep("form");
      void load(true);
    }
  };

  /* The note: two lines, growing to five with what is typed, then it
     scrolls. */
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
  const busy = busyMark(step);
  /* Confirm's words turn into the orbs, then a check. */
  const okMark = okMarkOf(ok);
  /* JG V3: the steps around anything that is not the picker itself. */
  const v3paid = paid || isPaid(slug);
  const v3steps = v3paid ? ["Time", "You", "Deposit", "Booked"] : ["Time", "You", "Booked"];
  // The same subtitle as the picker, so nothing below it jumps when the times arrive.
  const v3sub = v3paid ? "Studio in San Jose. I travel across the Bay Area." : "15 minutes, phone or video. Bring your dates and references.";
  /* While the times load the bar is already there, held off: it popped in
     a second after the page on a short screen, where it is the thing at the
     foot of the view (MAC, iPhone Duo folded, 2026-11-08). */
  const heldBar = <button type="button" className="btn fill" disabled>Continue</button>;
  // in the div `V3Steps` puts the shell in, so the shell stays one element as the times come
  const v3plain = (body: React.ReactNode, bar?: React.ReactNode) => <div className="contents">{v3!.shell({ steps: v3steps, at: 1, head: v3paid ? "Book a session" : v3!.name === "Consultation" ? "Book a consultation" : "Book a call", sub: v3sub, body, sum: [], bar })}</div>;
  return { path, title, className, fallback, v3, onPicked, username, slug, tz, clockHere, here, setHere, length, setLength, needsWhere, setNeedsWhere, opt, setOpt, via, setVia, ask, setAsk, session, setSession, booked, setBooked, days, setDays, state, setState, held, setHeld, orb, setOrb, jg, view, setView, anchor, setAnchor, pick, setPick, arrow, chosen, setChosen, step, setStep, swipeX, wheelGate, stripEl, stripRef, more, setMore, paid, setPaid, deposit, setDeposit, refs, setRefs, typed, smooth, root, v3root, was, error, setError, bad, setBad, blank, setBlank, ok, setOk, handOff, load, lo, hi, open, steps, choose, showTimes, today, week, month, slide, setSlide, swipe, shift, daysBox, mstep, setMstep, switchView, monthGrid, big, slotsBox, gs, seen, slotsW, setSlotsW, slotsRO, slotsRef, at, lastPick, refit, first, shown, atStart, book, grow, refill, busy, okMark, swipeProps, v3paid, v3steps, v3sub, heldBar, v3plain };
}

type Picker = ReturnType<typeof usePicker>;
/** What a card draws from: the picker, with a time on show. */
export type CardCtx = Omit<Picker, "pick" | "days"> & { pick: PickedTime; days: Record<string, Slot[]>; t: string; ap: string; until: string; date: Date; sum: string; waiting: React.ReactElement };
