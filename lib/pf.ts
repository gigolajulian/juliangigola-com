"use client";

import * as React from "react";

/* Motion prototypes from a reference recording (Julian, 2026-11-19), all behind one flag:
   `?pf=all` turns every one on, `?pf=grow,cycle` only those, `?pf=0` clears. It holds for the visit
   (sessionStorage), so clicking into a project keeps it. Off by default. */
export const PF = ["grow", "cycle", "range", "open", "caps", "about"] as const;
export type PfItem = (typeof PF)[number];
const KEY = "jg-pf";

/** The items on, read after mount only (the page stays static). */
export function pfOn(): PfItem[] {
  const q = new URLSearchParams(location.search).get("pf");
  let f = q ?? "";
  try {
    if (q === null) f = sessionStorage.getItem(KEY) ?? "";
    else if (!q || q === "0") sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, q);
  } catch {}
  if (f === "all") return [...PF];
  return f.split(",").filter((k): k is PfItem => (PF as readonly string[]).includes(k));
}

export function usePf(k: PfItem) {
  const [on, setOn] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setOn(pfOn().includes(k)), [k]);
  return on;
}

/** Skip frame cycling where it costs the visitor: reduced motion and Save-Data. */
export const lite = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches || !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
