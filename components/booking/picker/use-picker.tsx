"use client";

import * as React from "react";
import type { DepositBody } from "@/components/booking/deposit-step";
import { ORB_ROUND } from "@/components/effects/orb";
import { TZ } from "@/lib/time-zone";
import { e164, fromIso, minutesOf, WHERE, type PickedTime, type Step, type StepsSkin } from "@/components/booking/picker/parts";
import { byCodeUnit } from "@/lib/utils";
import { clockHere } from "@/components/booking/picker/dates";
import { forgetTimes, useSlots } from "@/components/booking/picker/use-slots";
import { usePickerDays } from "@/components/booking/picker/use-days";
import { warmGsap } from "@/lib/motion/gsap-lazy";
import { postJson } from "@/lib/http";


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
  skin?: StepsSkin;
  /** A time picked and confirmed: handed here instead of opening the form (a reschedule). */
  onPicked?: (start: string) => void;
  /** The days the card opens on: the month unless asked (the home opens on the week). */
  startView?: "week" | "month";
};

/* The picker's state, times and motion; the cards below only draw it. */
export function usePicker({ path, title, className, skin, onPicked, startView }: Props): Picker {
  const [username, slug] = path.split("/");
  const [tz] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || TZ);
  const [here, setHere] = React.useState(clockHere);
  React.useEffect(() => {
    const t = setInterval(() => setHere(clockHere()), 15000);
    return () => clearInterval(t);
  }, []);
  const { length, needsWhere, session, days, state, paid, load } = useSlots(username, slug, tz);
  const [opt, setOpt] = React.useState("");
  /** Who booked, for the page that follows. */
  /* `via`: a call taken by video (its Google Meet link) or by phone. */
  const [booked, setBooked] = React.useState({ name: "", email: "", where: "", phone: "", via: "" });
  /* The picker is not drawn while held: the effects that measure it
     re-run on `held`, or they ran on nothing and the week never fitted. */
  const [held, setHeld] = React.useState(true);
  const { view, setView, anchor, setAnchor, pick, setPick, chosen, setChosen, choose, today, week, month, shift, mstep, setMstep, switchView, atStart } = usePickerDays(days, startView);
  const [step, setStep] = React.useState<Step>("pick");
  const [deposit, setDeposit] = React.useState<DepositBody | null>(null);
  /* JG V3: references picked on the details step, sent with the deposit. */
  const [refs, setRefs] = React.useState<FormData | null>(null);
  /* What was typed, put back when the deposit step goes back to the form. */
  const typed = React.useRef<Record<string, string>>({});
  const [error, setError] = React.useState("");
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

  const open = (date: string) => new Set((days?.[date] ?? []).map((s) => minutesOf(s)));

  /* First open day and time, once there are any. */
  React.useEffect(() => {
    if (state !== "ready" || !days || pick) return;
    const date = Object.keys(days).filter((d) => days[d].length).sort(byCodeUnit)[0];
    if (!date) return;
    const s = days[date][0];
    setPick({ date, min: minutesOf(s), start: s });
    setAnchor(fromIso(date));
  }, [state, days, pick, setPick, setAnchor]);

  /* The time picked went (taken while the form was filled in, and the
     times loaded again): the day stays, the time is to pick again. */
  React.useEffect(() => {
    if (!pick || chosen !== "time" || !days) return;
    if (!days[pick.date]?.some((x) => minutesOf(x) === pick.min)) {
      setChosen("day");
    }
  }, [days, pick, chosen, setChosen]);

  /* Both looks move with GSAP (each card's own layout hook): it loads once the picker mounts. */
  React.useEffect(warmGsap, []);

  /* The two looks book alike but for two things: the stepper's phone is
     optional, and only the editorial card's orb has a moment to wait for. */
  const phoneOptional = !!skin;
  const orbMoment = !skin;

  const book = async (form: FormData) => {
    if (!pick) return;
    const f = readBookingForm(form, slug);
    typed.current = f.typed;
    setStep("sending");
    setError("");
    const began = Date.now();
    // JG V3: the phone is optional; one typed has to be a number.
    if (!f.phone && (!phoneOptional || f.phoneRaw)) {
      setError("Check your phone number. Add the country code if it is not a US number.");
      setStep("form");
      return;
    }
    const start = new Date(pick.start).toISOString();
    const extra = { ...(f.notes ? { notes: f.notes } : {}), ...(needsWhere ? { where: f.where } : {}) };
    if (paid) {
      setBooked({ name: f.firstName, email: f.email.trim(), where: f.where, phone: f.phone, via: "" });
      setDeposit({ slug, start, timeZone: tz, name: f.name, email: f.email, phone: f.phone, ...extra, session });
      setRefs(f.refs);
      setStep("pay");
      return;
    }
    /* Development only: `?sim=ok` books nothing, to see the page after. */
    const sim = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).get("sim") === "ok";
    try {
      if (!sim) {
        const r = await postJson("/api/book", { slug, start, timeZone: tz, name: f.name, email: f.email, phone: f.phone, via: f.via, ...extra });
        if (!r.ok) throw Object.assign(new Error(r.error || "failed"), { status: r.status, said: r.error, code: r.code });
      }
      setBooked({ name: f.firstName, email: f.email.trim(), where: f.where, phone: f.phone, via: f.via });
      /* The orbs get their moment even when the server answers at once, then
         turn into the check, which is shown before the page that follows. */
      if (orbMoment) {
        await new Promise((go) => setTimeout(go, Math.max(0, ORB_ROUND.solving - (Date.now() - began))));
        setStep("check");
        await new Promise((go) => setTimeout(go, 1500));
      }
      // The time is taken now: the next picker asks again.
      forgetTimes(username, slug, tz);
      setStep("done");
    } catch (e) {
      const { status, said, code } = e as Error & { status?: number; said?: string; code?: string };
      let why = "That did not go through. Try again, or write to hello@juliangigola.com.";
      if (code === "taken") why = "That time was just taken. Pick another.";
      // 429 and 503 carry the route's own words ("Too many tries. Wait a minute.", `app/api/book`).
      else if ((status === 429 || status === 503) && said) why = said;
      setError(why);
      setStep("form");
      void load(true);
    }
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
  return {
    title, className, skin, username, slug, tz, here,
    length, needsWhere, session, days, state, paid, load,
    held, unhold: () => setHeld(false),
    view, setView, anchor, setAnchor, pick, chosen, setChosen, choose, today, week, month, shift, mstep, setMstep, switchView, atStart,
    opt, setOpt, booked, step, setStep, deposit, refs, error, ok, setOk,
    open, book, refill,
  };
}

/** A booking form as `book` reads it, both looks: JG V3 asks one Name, the editorial card first and last; the
    stepper's references ride along for a deposit. */
export function readBookingForm(form: FormData, slug: string) {
  const typed = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
  const opts = WHERE[slug];
  const picked = opts?.length === 1 ? opts[0][0] : String(form.get("opt") || "");
  const asked = opts?.find(([label]) => label === picked)?.[1];
  const where = opts ? [picked, asked ? String(form.get("detail") || "").trim() : ""].filter(Boolean).join(": ") : String(form.get("where") || "").trim();
  const phoneRaw = String(form.get("phone") || "").trim();
  const name = String(form.get("name") ?? `${String(form.get("first")).trim()} ${String(form.get("last")).trim()}`).trim();
  const refs = new FormData();
  form.getAll("refs").forEach((f) => f instanceof File && f.size && refs.append("refs", f));
  if (form.get("picks")) refs.append("picks", String(form.get("picks")));
  return {
    typed,
    where,
    phoneRaw,
    phone: e164(phoneRaw),
    notes: String(form.get("notes") || "").trim(),
    name,
    firstName: name.split(/\s+/)[0],
    /** As typed: the request sends it so, the page after shows it trimmed. */
    email: String(form.get("email")),
    // A call (editorial): by video on its Meet link, or I ring the number.
    via: String(form.get("via") || ""),
    refs: refs.has("refs") || refs.has("picks") ? refs : null,
  };
}

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Slots = ReturnType<typeof useSlots>;
type Days = ReturnType<typeof usePickerDays>;
/** What the picker hands its cards: the booking's data and actions. Each card keeps its own layout (`usePickerLayout`
    in the editorial card, `useStepsLayout` beside the stepper). */
export type Picker = Pick<Props, "title" | "className" | "skin"> &
  /* the times as loaded */
  Pick<Slots, "length" | "needsWhere" | "session" | "days" | "state" | "paid" | "load"> &
  /* the days on show and the pick */
  Pick<Days, "view" | "setView" | "anchor" | "setAnchor" | "pick" | "chosen" | "setChosen" | "choose" | "today" | "week" | "month" | "shift" | "mstep" | "setMstep" | "switchView" | "atStart"> & {
    username: string;
    slug: string;
    tz: string;
    here: ReturnType<typeof clockHere>;
    /** True until J and G let go; `unhold` is theirs to call. */
    held: boolean;
    unhold: () => void;
    /* the steps and the form */
    opt: string;
    setOpt: Setter<string>;
    booked: { name: string; email: string; where: string; phone: string; via: string };
    step: Step;
    setStep: Setter<Step>;
    deposit: DepositBody | null;
    refs: FormData | null;
    error: string;
    ok: "" | "spin" | "tick";
    setOk: Setter<"" | "spin" | "tick">;
    open: (date: string) => Set<number>;
    book: (form: FormData) => Promise<void>;
    refill: (f: HTMLFormElement | null) => void;
  };

/** What a card draws from: the picker, with a time on show. */
export type CardCtx = Omit<Picker, "pick" | "days"> & { pick: PickedTime; days: Record<string, string[]>; t: string; ap: string; until: string; date: Date; sum: string };
