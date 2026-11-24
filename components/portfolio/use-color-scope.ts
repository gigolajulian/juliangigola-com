"use client";

import * as React from "react";

export type Scope = Record<string, { w: string[]; p: number[] }>;
export type PickAt = { a: number; c: number };

export const ang = (u: number, v: number) => Math.atan2(v, u);
const dAng = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** The Color view's scope points, fetched on first visit, and how well a set matches the pick. */
export function useColorScope(view: string, pick: PickAt | null) {
  const [scope, setScope] = React.useState<Scope | null>(null);

  /* The scope's points arrive with the Color view, not with the page. A
     failed load leaves it unset, so the next visit to Color asks again. */
  React.useEffect(() => {
    if (view !== "color" || scope) return;
    void fetch("/v3/work-scope.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`scope ${r.status}`))))
      .then(setScope)
      .catch(() => {});
  }, [view, scope]);

  const scoreSet = React.useCallback(
    (s: string) => {
      const pts = scope?.[s]?.p ?? [];
      if (!pick) return 0;
      let hit = 0;
      const n = pts.length / 2 || 1;
      const minC = Math.max(10, pick.c * 0.45);
      for (let i = 0; i < pts.length; i += 2) {
        const u = pts[i],
          v = pts[i + 1];
        if (Math.hypot(u, v) > minC && dAng(ang(u, v), pick.a) < 0.38) hit++;
      }
      return hit / n;
    },
    [scope, pick],
  );

  return { scope, scoreSet };
}
