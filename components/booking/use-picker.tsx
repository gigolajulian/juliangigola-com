"use client";

import * as React from "react";
import type { DepositBody } from "@/components/booking/deposit-step";
import { takesDeposit } from "@/lib/booking/paid";
import { ORB_ROUND } from "@/components/effects/orb";
import { TZ } from "@/lib/booking/rules";
import { e164, fromIso, minutesOf, forgetTimes, WHERE, type PickedTime, type Step, type StepsSkin } from "@/components/booking/time-picker-parts";
import { byCodeUnit } from "@/lib/utils";
import { clockHere } from "@/components/booking/picker-dates";
import { useSlots } from "@/components/booking/use-slots";
import { usePickerDays } from "@/components/booking/use-picker-days";
import { usePickerLayout } from "@/components/booking/use-picker-layout";
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
  /* A call, editorial: by video (its Meet link) or phone, I ring them. */
  const [via, setVia] = React.useState<"Video" | "Phone">("Video");
  /** The follow-up question, kept while it folds shut so its text does not vanish first. */
  const [ask, setAsk] = React.useState("");
  /** Who booked, for the page that follows. */
  /* `via`: a call taken by video (its Google Meet link) or by phone. */
  const [booked, setBooked] = React.useState({ name: "", email: "", where: "", phone: "", via: "" });
  /* The picker is not drawn while held: the effects that measure it
     re-run on `held`, or they ran on nothing and the week never fitted. */
  const [held, setHeld] = React.useState(true);
  const { view, setView, anchor, setAnchor, pick, setPick, chosen, setChosen, choose, today, week, month, shift, mstep, setMstep, switchView, atStart } = usePickerDays(days, startView);
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

  const { stripRef, more, setMore, root, v3root, showTimes, daysBox, slotsW, slotsRef, swipeProps } = usePickerLayout({ step, pick, days, view, anchor, week, month, chosen, mstep, held, state, atStart, shift });

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
    if (!phone && (!skin || raw)) {
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
      setDeposit({ slug, start: new Date(pick.start).toISOString(), timeZone: tz, name, email: String(form.get("email")), phone, ...(notes ? { notes } : {}), ...(needsWhere ? { where } : {}), session });
      const sent = new FormData();
      form.getAll("refs").forEach((f) => f instanceof File && f.size && sent.append("refs", f));
      if (form.get("picks")) sent.append("picks", String(form.get("picks")));
      setRefs(sent.has("refs") || sent.has("picks") ? sent : null);
      setStep("pay");
      return;
    }
    // A call (editorial): by video on its Meet link, or I ring the number.
    const formVia = String(form.get("via") || "");
    /* Development only: `?sim=ok` books nothing, to see the page after. */
    const sim = process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).get("sim") === "ok";
    try {
      if (!sim) {
        const r = await postJson("/api/book", { slug, start: new Date(pick.start).toISOString(), timeZone: tz, name, email: String(form.get("email")), phone, via: formVia, ...(notes ? { notes } : {}), ...(needsWhere ? { where } : {}) });
        if (!r.ok) throw Object.assign(new Error(r.error || "failed"), { status: r.status, said: r.error, code: r.code });
      }
      setBooked({ name: firstName, email: String(form.get("email")).trim(), where, phone, via: formVia });
      /* The orbs get their moment even when the server answers at once, then
         turn into the check, which is shown before the page that follows. */
      // JG V3 draws no orb, so it has no moment to wait for.
      if (!skin) {
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
  /* JG V3: the steps around anything that is not the picker itself. */
  const v3paid = paid || takesDeposit(slug);
  const v3steps = v3paid ? ["Time", "You", "Deposit", "Booked"] : ["Time", "You", "Booked"];
  // The same subtitle as the picker, so nothing below it jumps when the times arrive.
  const v3sub = v3paid ? "Studio in San Jose. I travel across the Bay Area." : "15 minutes, phone or video. Bring your dates and references.";
  return {
    title, className, skin, username, slug, tz, here,
    length, needsWhere, session, days, state, paid, load,
    held, unhold: () => setHeld(false),
    view, setView, anchor, setAnchor, pick, chosen, setChosen, choose, today, week, month, shift, mstep, setMstep, switchView, atStart,
    stripRef, more, setMore, root, v3root, showTimes, daysBox, slotsW, slotsRef, swipeProps,
    opt, setOpt, via, setVia, ask, setAsk, booked, step, setStep, swipeX, wheelGate, deposit, refs, error, bad, setBad, blank, setBlank, ok, setOk,
    open, book, grow, refill, v3paid, v3steps, v3sub,
  };
}

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Slots = ReturnType<typeof useSlots>;
type Days = ReturnType<typeof usePickerDays>;
type Layout = ReturnType<typeof usePickerLayout>;
/** What the picker hands its cards: data and callbacks only, its setters and refs for the rest kept inside. */
export type Picker = Pick<Props, "title" | "className" | "skin"> &
  /* the times as loaded */
  Pick<Slots, "length" | "needsWhere" | "session" | "days" | "state" | "paid" | "load"> &
  /* the days on show and the pick */
  Pick<Days, "view" | "setView" | "anchor" | "setAnchor" | "pick" | "chosen" | "setChosen" | "choose" | "today" | "week" | "month" | "shift" | "mstep" | "setMstep" | "switchView" | "atStart"> &
  /* the boxes the cards hang refs and gestures on */
  Pick<Layout, "stripRef" | "more" | "setMore" | "root" | "v3root" | "showTimes" | "daysBox" | "slotsW" | "slotsRef" | "swipeProps"> & {
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
    via: "Video" | "Phone";
    setVia: Setter<"Video" | "Phone">;
    ask: string;
    setAsk: Setter<string>;
    booked: { name: string; email: string; where: string; phone: string; via: string };
    step: Step;
    setStep: Setter<Step>;
    swipeX: React.RefObject<number | null>;
    wheelGate: React.RefObject<{ at: number; owned: boolean }>;
    deposit: DepositBody | null;
    refs: FormData | null;
    error: string;
    bad: Record<string, string>;
    setBad: Setter<Record<string, string>>;
    blank: Record<string, boolean>;
    setBlank: Setter<Record<string, boolean>>;
    ok: "" | "spin" | "tick";
    setOk: Setter<"" | "spin" | "tick">;
    open: (date: string) => Set<number>;
    book: (form: FormData) => Promise<void>;
    grow: (e: React.FormEvent<HTMLTextAreaElement>) => void;
    refill: (f: HTMLFormElement | null) => void;
    /* JG V3's steps and subtitle */
    v3paid: boolean;
    v3steps: string[];
    v3sub: string;
  };

/** What a card draws from: the picker, with a time on show. */
export type CardCtx = Omit<Picker, "pick" | "days"> & { pick: PickedTime; days: Record<string, string[]>; t: string; ap: string; until: string; date: Date; sum: string };
