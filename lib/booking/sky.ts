/* ── the hour's light, for the time picker (?sky, flagged) ─────────
 * Each start time takes the color of the sky at that hour in San Jose:
 * gold in the morning, coral near sunset, cobalt after. The colors were
 * sampled from three of Julian's skies (golden cirrus #f5a649, a red-coral
 * dawn #ee5a22, a cobalt midday #2e527a) and lifted or dropped to read on
 * each ground. The day follows the real sun, DST included: the hours are
 * moved onto the light of the day the colors were tuned on (2026-11-26).
 * Client-safe: imports only the zone, the clock and `pad`.
 * ─────────────────────────────────────────────────────────────── */

import { TZ, DAY_MS } from "@/lib/time-zone";
import { clockLabel } from "@/lib/booking/clock";
import { pad } from "@/lib/utils";

type Stop = readonly [hour: number, l: number, c: number, h: number];

/* Tuned on the dark ground; blended in OKLab so coral fades through dusk grey into cobalt, never purple. */
const DARK: Stop[] = [[10, 0.86, 0.11, 78], [12, 0.82, 0.135, 72], [14, 0.8, 0.143, 70], [16, 0.74, 0.16, 52], [17, 0.7, 0.175, 35], [18, 0.68, 0.045, 245], [19, 0.66, 0.11, 256], [20, 0.6, 0.11, 253]];
/* The same hues dropped to read as text (4.5:1) on the light ground. */
const LIGHT: Stop[] = DARK.map(([h, l, c, hu]) => [h, Math.min(l, 0.5), c * 0.9, hu]);

/** The three dots on a day: morning, afternoon, evening. Fixed all year. */
export const PARTS = [
  { name: "Morning", dark: "oklch(0.8 0.143 70)", light: "oklch(0.6 0.14 70)" },
  { name: "Afternoon", dark: "oklch(0.68 0.18 35)", light: "oklch(0.56 0.18 35)" },
  { name: "Evening", dark: "oklch(0.66 0.11 253)", light: "oklch(0.5 0.11 253)" },
] as const;

/** Which part of the day a start (minutes after local midnight) falls in. */
export const partOf = (min: number) => (min < 720 ? 0 : min < 1020 ? 1 : 2);

const rad = Math.PI / 180;

/** Sunrise, solar noon and sunset in San Jose on `ymd`, as hours on the Pacific clock (NOAA approximation, about a minute off). */
export function sun(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / DAY_MS);
  const g = ((2 * Math.PI) / 365) * (doy - 1), C = Math.cos, S = Math.sin, lat = 37.34 * rad, lon = -121.89;
  const eq = 229.18 * (0.000075 + 0.001868 * C(g) - 0.032077 * S(g) - 0.014615 * C(2 * g) - 0.040849 * S(2 * g));
  const de = 0.006918 - 0.399912 * C(g) + 0.070257 * S(g) - 0.006758 * C(2 * g) + 0.000907 * S(2 * g) - 0.002697 * C(3 * g) + 0.00148 * S(3 * g);
  const ha = Math.acos(C(90.833 * rad) / (C(lat) * C(de)) - Math.tan(lat) * Math.tan(de)) / rad;
  const off = pacificOffset(Date.UTC(y, m - 1, d, 20));
  const at = (min: number) => min / 60 + off;
  return { rise: at(720 - 4 * (lon + ha) - eq), noon: at(720 - 4 * lon - eq), set: at(720 - 4 * (lon - ha) - eq) };
}

/** Pacific's offset from UTC in hours at `ms` (-8, or -7 in DST). */
function pacificOffset(ms: number) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(ms).find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  return Number(name.slice(3)) || -8;
}

/** The Pacific date and hour (with minutes as a fraction) of an instant. */
export function pacific(ms: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ms).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) + Number(p.minute) / 60 };
}

const REF = sun("2026-11-26");

/** An hour on `ymd` moved onto the tuned day's light: sunrise to noon to sunset stretch, after sunset counts in real hours. */
export function warp(hour: number, ymd: string) {
  const s = sun(ymd);
  if (hour <= s.noon) return REF.noon - ((s.noon - hour) * (REF.noon - REF.rise)) / (s.noon - s.rise);
  if (hour <= s.set) return REF.noon + ((hour - s.noon) * (REF.set - REF.noon)) / (s.set - s.noon);
  return REF.set + (hour - s.set);
}

function blend(stops: Stop[], hour: number) {
  const ab = ([, l, c, h]: Stop) => [l, c * Math.cos(h * rad), c * Math.sin(h * rad)];
  let v = ab(stops.at(-1)!);
  for (let i = 0; i < stops.length - 1; i++) {
    if (hour > stops[i + 1][0]) continue;
    const t = Math.max(0, (hour - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
    const a = ab(stops[i]), b = ab(stops[i + 1]);
    v = a.map((x, k) => x + (b[k] - x) * t);
    break;
  }
  const [l, a, b] = v;
  return `oklch(${l.toFixed(3)} ${Math.hypot(a, b).toFixed(3)} ${((Math.atan2(b, a) / rad + 360) % 360).toFixed(1)})`;
}

/** The two colors of the light at an instant: on the dark ground and on the light one. */
export function tone(ms: number) {
  const { ymd, hour } = pacific(ms);
  const w = warp(hour, ymd);
  return { dark: blend(DARK, w), light: blend(LIGHT, w) };
}

/** "6:06 PM": sunset in San Jose on a Pacific date. */
export function sunsetLabel(ymd: string) {
  const s = sun(ymd).set, h = Math.floor(s);
  // sunset falls in the evening, so the minutes never reach midnight
  return clockLabel(h * 60 + Math.round((s - h) * 60));
}

/** Where an hour sits against the sun that day, in plain words: "52 min to sunset". */
export function sunHint(ms: number) {
  const { ymd, hour } = pacific(ms);
  const s = sun(ymd);
  const f = (x: number) => (x < 0.92 ? `${Math.round(x * 60)} min` : `${Math.round(x * 2) / 2} h`.replace(".5", "½"));
  if (hour < s.noon - 0.5) return `${f(hour - s.rise)} after sunrise`;
  if (hour < s.set - 3) return "Sun high";
  return hour < s.set ? `${f(s.set - hour)} to sunset` : `${f(hour - s.set)} after sunset`;
}

/** Open-Meteo's hourly forecast as /api/weather passes it on: Pacific wall times, °F, WMO codes. */
export type Hourly = { time: string[]; temperature_2m: number[]; weather_code: number[] };

/** A WMO weather code in a plain word or two. */
export function weatherWord(code: number) {
  if (code <= 1) return "Clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77 || code === 85 || code === 86) return "Snow";
  if (code <= 82) return "Showers";
  return "Thunderstorms";
}

/** "Clear, 62°": the forecast for the hour a start falls in, or null past the forecast's reach. */
export function weatherAt(hourly: Hourly | null, ms: number) {
  const { ymd, hour } = pacific(ms);
  const i = hourly?.time.indexOf(`${ymd}T${pad(Math.floor(hour))}:00`) ?? -1;
  if (!hourly || i < 0 || hourly.temperature_2m[i] == null || hourly.weather_code[i] == null) return null;
  return `${weatherWord(hourly.weather_code[i])}, ${Math.round(hourly.temperature_2m[i])}°`;
}
