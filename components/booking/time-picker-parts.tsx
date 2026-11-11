"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Shell } from "@/components/v3/flow";

/* Shared by the time picker and its cards (time-picker.tsx). */

export const noop = () => () => {};
/* An event's details and times, kept a minute, so a picker built again
   (the homepage menu builds one per row pointed at) does not ask the
   server again. A reload after a failed booking asks fresh. */
export const KEEP = 60_000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const recent = new Map<string, { at: number; got: Promise<[any, any]> }>();
export const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
/** The kinds of time the open times are grouped in, by start, in minutes. */
export const PARTS = [["Morning", 0, 720], ["Afternoon", 720, 1020], ["Evening", 1020, 1440]] as const;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** How far ahead times are asked for. */
export const AHEAD = 120;

export type Slot = { start: string; end: string };
export type V3Book = { shell: Shell; name: string; from: number | null };
export type Pick = { date: string; min: number; start: string };

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const minutesOf = (start: string) => +start.slice(11, 13) * 60 + +start.slice(14, 16);
/** Where the session happens, per event: the choices, and what to ask after one. An event
    with a single choice asks nothing; one not listed gets a plain text box. */
export const WHERE: Record<string, [label: string, ask?: string][]> = {
  graduation: [["On campus", "Which campus?"], ["In studio"]],
  portraits: [["Studio"], ["Outdoor", "Where?"], ["Your location", "Where?"]],
  headshots: [["Studio"], ["On location", "Address"]],
  digitals: [["Studio"]],
};

/** The zone's short name ("PDT", or PST by the date); no city (Julian,
    2026-10-16). */
export const zone = (start: string, tz: string) => {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date(start))
      .find((p) => p.type === "timeZoneName")?.value ?? tz.replace(/_/g, " ")
  );
};
/** A phone number as +E.164: a US number without its country code gets +1. */
export const e164 = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return "";
};
export const clock = (m: number): [string, string] => {
  const h = Math.floor(m / 60);
  return [`${((h + 11) % 12) + 1}:${pad(m % 60)}`, h % 24 < 12 ? "AM" : "PM"];
};

/* How far the picker runs past its own padding. Its scrollHeight missed
   the bar running into the bottom padding, and Confirm sat on the card's
   edge (Julian). Offsets, not rects, so a zoomed page measures true. */
export const overflowOf = (tp: HTMLElement) => {
  const bar = tp.querySelector<HTMLElement>(":scope > .sticky");
  const end = tp.clientHeight - parseFloat(getComputedStyle(tp).paddingBottom);
  // Where the picker grows with its times (a service page's call), the
  // box around it is what clips, so its overflow counts too.
  const host = tp.parentElement;
  return Math.max(tp.scrollHeight - tp.clientHeight, host ? host.scrollHeight - host.clientHeight : 0, bar ? Math.ceil(bar.offsetTop + bar.offsetHeight - end - 1) : 0); // 1px: offsets round
};

/* The day's open times as bars: the week and the month draw a day the
   same way (Julian, 2026-10-11). A bar grows by scale, not height: a
   month is hundreds of bars and height laid them all out every frame. */
export function Bars({ steps, open, on, className }: { steps: number[]; open: Set<number>; on: boolean; className?: string }) {
  return (
    // A day of quarter hours on a phone tile: the gaps alone were wider
    // than the tile and the bars went to nothing.
    <span aria-hidden className={cn("flex items-end bg-current/10", steps.length > 16 ? "gap-0" : "gap-px", !on && "text-accent", className)}>
      {steps.map((m) => (
        <s key={m} className="h-full w-[3px] max-sm:w-px flex-1 origin-bottom rounded-[1px] bg-current no-underline opacity-55 transition-transform duration-500" style={{ transform: open.has(m) ? "none" : "scaleY(.22)" }} />
      ))}
    </span>
  );
}

/* A view that folds shut and open, so Week and Month trade places smoothly. */
/** `fill`: open, it takes the room the picker has to spare, and its
    children stack so one can be pushed down with `mt-auto`. */
export function Fold({ on, fill, children }: { on: boolean; fill?: boolean; children: React.ReactNode }) {
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

export type Step = "pick" | "form" | "sending" | "check" | "pay" | "done";
/** Which of the three steps (pick, details, pay) the progress marks; "done" is handled where it differs. */
export const STEP_AT: Record<Exclude<Step, "done">, number> = { pick: 0, form: 1, sending: 1, check: 1, pay: 2 };
