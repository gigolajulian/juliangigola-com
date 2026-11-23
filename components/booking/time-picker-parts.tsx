"use client";

import { iso, type Shell } from "@/components/booking/flow";
import { pad } from "@/lib/utils";
import type { SlotsAnswer } from "@/lib/booking/slots";

export { iso, pad };

/* Shared by the time picker and its cards (time-picker.tsx). */

/* An event's details and times, kept a minute, so a picker built again
   (the homepage menu builds one per row pointed at) does not ask the
   server again. A reload after a failed booking asks fresh. */
export const KEEP = 60_000;
export const recent = new Map<string, { at: number; got: Promise<SlotsAnswer> }>();
/** The key an event's times are kept under. */
export const recentKey = (username: string, slug: string, tz: string) => `${username}/${slug}/${tz}`;
/** Forget an event's kept times, so the next picker asks fresh (a time just taken). */
export const forgetTimes = (username: string, slug: string, tz: string) => void recent.delete(recentKey(username, slug, tz));
export const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** How far ahead times are asked for. */
export const AHEAD = 120;

export type Slot = { start: string; end: string };
export type V3Book = { shell: Shell; name: string; from: number | null };
/** The time picked: its day, minutes after midnight, and the start as sent. */
export type PickedTime = { date: string; min: number; start: string };

export const fromIso = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const minutesOf = (start: string) => +start.slice(11, 13) * 60 + +start.slice(14, 16);
/** Where the session happens, per event: the choices, and what to ask after one. An event
    with a single choice asks nothing; one not listed gets a plain text box. */
export const WHERE: Record<string, [label: string, ask?: string][]> = {
  graduation: [["On campus", "Which campus?"], ["In studio"]],
  portraits: [["Studio"], ["Outdoor", "Where?"], ["Your location", "Where?"]],
  headshots: [["Studio"], ["On location", "Address"]],
  digitals: [["Studio"]],
  "model-test": [["Studio"]],
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

export type Step = "pick" | "form" | "sending" | "check" | "pay" | "done";
/** Which of the three steps (pick, details, pay) each step is, in order; the progress marks handle "done" where they differ. */
export const STEP_AT: Record<Step, number> = { pick: 0, form: 1, sending: 1, check: 1, pay: 2, done: 3 };
