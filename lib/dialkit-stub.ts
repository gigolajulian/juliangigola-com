/* DialKit in a production build (`next.config.ts` aliases `dialkit` here).
 *
 * Julian: the dials on the dev server only. The panels never rendered in
 * production (DialRoot's own default), but the library shipped to every
 * visitor anyway, 72KB gzipped, because the hero, the page dials and the
 * wall behind the ask read their values through `useDialKit`. Here those
 * reads return the defaults written in the config, the same values the
 * real hook returns when nothing has been moved, and nothing else of
 * DialKit is built in.
 *
 * Ported from `resolveDialValues` / `configDefaultValue` in
 * `dialkit/dist/index.js`: a config value is a leaf (a [default, min, max,
 * step] array, a number, boolean or string, or a typed control) or a
 * folder of them. */
import { useMemo } from "react";

type Config = Record<string, unknown>;
type Axis = [number, number, number, number?];

const typed = (v: unknown, type: string): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && (v as { type?: unknown }).type === type;
const TYPES = ["spring", "easing", "action", "select", "color", "image", "text", "pad"];

const isLeaf = (v: unknown) =>
  (Array.isArray(v) && v.length <= 4 && typeof v[0] === "number") ||
  typeof v === "number" ||
  typeof v === "boolean" ||
  typeof v === "string" ||
  TYPES.some((t) => typed(v, t));

const firstOption = (options: unknown[]) => {
  const first = options[0];
  if (first === undefined) return "";
  return typeof first === "string" ? first : (first as { value: unknown }).value;
};

/* A pad's default sits on its own step, as DialKit snaps it. */
const padAxis = (config: Axis = [0, -1, 1, 0.01]) => {
  const [initial, min, max, given] = config;
  const step = given ?? (max - min) / 200;
  const clamped = Math.max(min, Math.min(max, initial));
  if (clamped === min || clamped === max) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.max(min, Math.min(max, Number(snapped.toPrecision(12))));
};

function defaultOf(v: unknown): unknown {
  if (Array.isArray(v)) return v[0];
  if (typed(v, "select")) return v.default ?? firstOption(v.options as unknown[]);
  if (typed(v, "color")) return v.default ?? "#000000";
  if (typed(v, "image")) return v.default ?? firstOption((v.options as unknown[]) ?? []);
  if (typed(v, "text")) return v.default ?? "";
  if (typed(v, "pad")) return { x: padAxis(v.x as Axis), y: padAxis(v.y as Axis) };
  return v;
}

function resolve(config: Config): Config {
  const out: Config = {};
  for (const [key, v] of Object.entries(config)) {
    if (key === "_collapsed") continue;
    if (isLeaf(v)) out[key] = defaultOf(v);
    else if (typeof v === "object" && v !== null) out[key] = resolve(v as Config);
  }
  return out;
}

const noop = () => {};

export function useDialKit(...[, config]: [name: string, config: Config, options?: unknown]) {
  // One object per config's content, as the real hook memoizes on it, so
  // an inline config (the wall's) does not make new values every render.
  const key = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the content
  return useMemo(() => resolve(config), [key]);
}

export function useDialKitController(name: string, config: Config, options?: unknown) {
  const values = useDialKit(name, config, options);
  return useMemo(() => ({ values, setValue: noop, setValues: noop }), [values]);
}

export function DialRoot() {
  return null;
}

export const DialStore = {
  getPanels: () => [] as { id: string; name: string }[],
  getValues: () => ({}) as Record<string, unknown>,
};
