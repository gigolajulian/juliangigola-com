import * as React from "react";
import Image from "next/image";
import { INITIAL, submitOrKeep } from "@/components/contact-form";
import { trailContext } from "@/components/visit-trail";
import type { ContactState } from "@/app/contact/actions";

/* JG V3 stepper (master v39, "one stepper" for booking and inquiry): the
   step rail, the head, the body, the action bar, and the sticky photo with
   a live summary. Each flow owns its state and fills these slots. */

const pad = (n: number) => String(n).padStart(2, "0");

export const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 7.5l3.2 3L12 3.5" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** What a flow fills in; the page adds the photo, the name and anything of its own. */
export type ShellParts = {
  steps: string[];
  at: number;
  ok?: string;
  head: React.ReactNode;
  sub?: React.ReactNode;
  body: React.ReactNode;
  bar?: React.ReactNode;
  sum: [string, React.ReactNode][];
};
export type Shell = (p: ShellParts) => React.ReactNode;

export function FlowShell({
  steps,
  at,
  ok,
  head,
  sub,
  body,
  bar,
  photo,
  name,
  sum,
  over,
}: {
  /** Step names; `at` is 1-based. An empty list draws no rail. */
  steps: string[];
  at: number;
  /** The last step's word over the head ("Booked", "Sent"). */
  ok?: string;
  head: React.ReactNode;
  sub?: React.ReactNode;
  body: React.ReactNode;
  bar?: React.ReactNode;
  photo: { d: string; l: string; m?: string; at?: { d?: string; l?: string } };
  name: string;
  sum: [string, React.ReactNode][];
  /** The caption over the photo with a line under the name, the photo
      running to the foot of the screen (Julian, every booking). */
  over?: string;
}) {
  const last = at === steps.length && steps.length > 0;
  return (
    <div className="flow">
      <div className="f-main">
        {steps.length ? (
          <ol className="rail lbl" aria-label="Steps">
            {steps.map((n, i) => (
              <li key={n} className={i + 1 === at ? "cur" : i + 1 < at || last ? "done" : undefined} aria-current={i + 1 === at ? "step" : undefined}>
                {pad(i + 1)} <span className="nm">{n}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="f-head">
          {ok ? (
            <span className="f-ok lbl">
              <Check />
              {ok}
            </span>
          ) : null}
          {/* keyed by step so a new heading mounts and rises (v3.css, motion plan 03) */}
          <h2>
            <span key={at} className="rh">{head}</span>
          </h2>
          {sub ? <p>{sub}</p> : null}
        </div>
        <div className="f-body">{body}</div>
        {bar ? <div className="f-bar">{bar}</div> : null}
      </div>
      <figure className={over != null ? "f-photo over" : "f-photo"}>
        <div className="in">
          <div className="ph">
            <Image className="v3d" src={photo.d} alt={`${name} sample frame`} fill sizes="(max-width: 800px) 100vw, 44vw" loading="eager" fetchPriority="high" decoding="sync" style={photo.at?.d ? ({ "--at": photo.at.d } as React.CSSProperties) : undefined} />
            <Image className="v3l" src={photo.l} alt={`${name} sample frame`} fill sizes="(max-width: 800px) 100vw, 44vw" loading="eager" decoding="sync" style={photo.at?.l ? ({ "--at": photo.at.l } as React.CSSProperties) : undefined} />
            {photo.m ? <Image className="v3m" src={photo.m} alt={`${name} sample frame`} fill sizes="100vw" loading="eager" decoding="sync" /> : null}
          </div>
          <div className="cap">
            <b>{name}</b>
            {over ? <p className="sub">{over}</p> : null}
            <dl className="lbl">
              {sum.map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </figure>
    </div>
  );
}

/** A run of short items (the session's includes): each item stays whole,
    a dot rides at the end of every item but the last, so a line may end on
    a dot but never starts with one or splits an item, and `.run` keeps the
    last line from holding a lone item. */
export function Run({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <p className={`run ${className}`}>
      {items.map((x, i) => (
        <React.Fragment key={x}>
          <span>{i < items.length - 1 ? `${x} ·` : x}</span>
          {i < items.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </p>
  );
}

/** A labelled field with the master's error box under it. */
export function Field({
  k,
  label,
  hint,
  type = "text",
  value,
  onChange,
  err,
  ac = "off",
  area,
  req,
}: {
  k: string;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  err?: string;
  ac?: string;
  area?: boolean;
  /** Required: an asterisk after the label. */
  req?: boolean;
}) {
  const id = `f-${k}`;
  return (
    <div className={err ? "fld bad" : "fld"}>
      <label className="lbl mute" htmlFor={id}>
        <span>
          {label}
          {req ? <span className="req" aria-hidden="true"> *</span> : null}
        </span>
        <span>{hint}</span>
      </label>
      {area ? (
        <textarea id={id} name={k} rows={3} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!err || undefined} aria-required={req || undefined} />
      ) : (
        <input id={id} name={k} type={type} autoComplete={ac} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!err || undefined} aria-required={req || undefined} />
      )}
      {err ? (
        <p className="err" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

/** Name and a real email (master `check()`): field → the one sentence that fixes it. */
export const checkYou = (name: string, email: string) => {
  const err: Record<string, string> = {};
  if (!name.trim()) err.name = "Add your name so I know who to reply to.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) err.email = "That email looks incomplete. Check it and try again.";
  return err;
};

/* Dates and times the way the master prints them. */
export const dlabel = (t: Date) => t.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
export const fmt = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${((h + 11) % 12) + 1}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`;
};
export const duration = (min: number) => (min >= 120 ? `${min / 60} hours` : `${min} minutes`);
export const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** The month's cells, Monday first, blanks before the 1st. */
export const monthCells = (base: Date) => {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const n = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return [...Array<Date | null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1))];
};
/** The Monday-to-Sunday week holding `d`. */
export const weekCells = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => new Date(m.getFullYear(), m.getMonth(), m.getDate() + i));
};

/** The calendar block (master step 1): title, Week / Month, arrows, the days. */
export function Calendar({
  view,
  setView,
  anchor,
  shift,
  canBack,
  canNext = true,
  picked,
  tag,
  onPick,
}: {
  view: "week" | "month";
  setView: (v: "week" | "month") => void;
  anchor: Date;
  shift: (dir: number) => void;
  canBack: boolean;
  canNext?: boolean;
  picked: string;
  /** A day's tag ("3 open", "Open") or null when it cannot be picked. */
  tag: (d: Date) => string | null;
  onPick: (d: Date) => void;
}) {
  const cells = view === "month" ? monthCells(anchor) : weekCells(anchor);
  const head = view === "month" ? anchor : (cells[0] as Date);
  return (
    <>
      <div className="cal-top lbl">
        <span>{head.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <span className="seg">
          <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
          <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
        </span>
        <span className="arrows">
          <button type="button" aria-label="Earlier" disabled={!canBack} onClick={() => shift(-1)}>&larr;</button>
          <button type="button" aria-label="Later" disabled={!canNext} onClick={() => shift(1)}>&rarr;</button>
        </span>
      </div>
      <div className={`cal lbl ${view}`}>
        {WD.map((w) => (
          <span key={w} className="wd">{w}</span>
        ))}
        {cells.map((t, k) => {
          if (!t) return <span key={`b${k}`} />;
          const id = iso(t);
          const tg = tag(t);
          return (
            <button key={id} type="button" data-day={id} aria-pressed={id === picked} disabled={tg === null} aria-label={`${dlabel(t)}${tg ? `, ${tg}` : ""}`} onClick={() => onPick(t)}>
              <b>{t.getDate()}</b>
              <span>{tg}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── the enquiry, shared by the note, the commission stepper and weddings ── */
const simSent = () => process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).get("sim") === "sent";
export const first = (name: string) => name.trim().split(" ")[0] ?? "";
export const NEED_MSG = "Tell me a little about what you have in mind.";

/** What the server could not take, with the mail-app way round it. */
export function Failed({ state }: { state: ContactState }) {
  if (state.status !== "error" && state.status !== "unconfigured") return null;
  return (
    <p className="err" role="alert">
      {state.message}
      {state.mailto ? <> <a href={state.mailto}>Open in your mail app</a></> : null}
    </p>
  );
}

/** The enquiry, posted the way `inquire-card.tsx` posts it. */
export function useEnquiry() {
  const [state, act, pending] = React.useActionState(submitOrKeep, INITIAL);
  const [sim, setSim] = React.useState(false);
  const send = (form: HTMLFormElement) => {
    if (simSent()) return setSim(true);
    const ctx = form.elements.namedItem("context");
    if (ctx instanceof HTMLInputElement) ctx.value = trailContext();
    const data = new FormData(form);
    React.startTransition(() => act(data));
  };
  return { state, pending, sent: sim || state.status === "sent", send };
}

export const Hidden = ({ type, detail }: { type: string; detail?: string }) => (
  <>
    {/* The honeypot (`contact-form.tsx`). */}
    <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />
    <input type="hidden" name="context" />
    <input type="hidden" name="type" value={type} />
    {detail ? <input type="hidden" name="detail" value={detail} /> : null}
  </>
);
