"use client";

import * as React from "react";
import { ang, type PickAt, type Scope } from "@/components/portfolio/use-color-scope";
import type { WorkItem } from "@/components/portfolio/work-tiles";

/* Vectorscope: Cb across, Cr up, as a broadcast scope draws it. */
const R = 128;
const rgb = (u: number, v: number) =>
  [140 + 1.402 * v, 140 - 0.344 * u - 0.714 * v, 140 + 1.772 * u].map((x) =>
    Math.max(0, Math.min(255, x | 0)),
  );
const TARGETS = (
  [
    ["R", 255, 0, 0],
    ["MG", 255, 0, 255],
    ["B", 0, 0, 255],
    ["CY", 0, 255, 255],
    ["G", 0, 255, 0],
    ["YL", 255, 255, 0],
  ] as const
).map(
  ([k, r, g, b]) =>
    [
      k,
      -0.1687 * r - 0.3313 * g + 0.5 * b,
      0.5 * r - 0.4187 * g - 0.0813 * b,
    ] as const,
);

/** Color view: draws the vectorscope on `cv` while the view is on, and turns a click on it into a pick. */
export function useScopeDraw(
  view: string,
  list: WorkItem[],
  scope: Scope | null,
  pick: PickAt | null,
  setPick: (p: PickAt | null) => void,
  cvRef: React.RefObject<HTMLCanvasElement | null>,
) {
  /* Draws the scope: rings, axes, targets, every cover's points, the pick. */
  const draw = React.useCallback(() => {
    const c = cvRef.current;
    if (!c || !c.clientWidth) return;
    const w = c.clientWidth,
      dpr = devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = w * dpr;
    const x = c.getContext("2d")!,
      css = getComputedStyle(document.documentElement),
      m = w / 2,
      k = (w / 2 - 6) / R;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.strokeStyle = css.getPropertyValue("--line");
    x.lineWidth = 1;
    [1, 0.66, 0.33].forEach((f) => {
      x.beginPath();
      x.arc(m, m, (w / 2 - 6) * f, 0, 7);
      x.stroke();
    });
    x.beginPath();
    x.moveTo(6, m);
    x.lineTo(w - 6, m);
    x.moveTo(m, 6);
    x.lineTo(m, w - 6);
    x.stroke();
    x.fillStyle = css.getPropertyValue("--mute");
    x.font = "9px IBM Plex Mono, monospace";
    x.textAlign = "center";
    TARGETS.forEach(([t, u, v]) =>
      x.fillText(t, m + u * k * 0.82, m - v * k * 0.82 + 3),
    );
    for (const p of list) {
      const pts = scope?.[p.s]?.p ?? [];
      for (let i = 0; i < pts.length; i += 2) {
        const [r, g, b] = rgb(pts[i], pts[i + 1]);
        x.fillStyle = `rgba(${r},${g},${b},.75)`;
        x.fillRect(m + pts[i] * k - 1, m - pts[i + 1] * k - 1, 2, 2);
      }
    }
    if (pick) {
      const px = m + Math.cos(pick.a) * pick.c * k,
        py = m - Math.sin(pick.a) * pick.c * k;
      // The picked wedge in the theme's ink, faint: white on the dark ground, near black on the light one.
      x.fillStyle = css.getPropertyValue("--ink");
      x.globalAlpha = 0.07;
      x.beginPath();
      x.moveTo(m, m);
      x.arc(m, m, w / 2 - 6, -pick.a - 0.38, -pick.a + 0.38);
      x.closePath();
      x.fill();
      x.globalAlpha = 1;
      const [r, g, b] = rgb(
        Math.cos(pick.a) * pick.c,
        Math.sin(pick.a) * pick.c,
      );
      x.fillStyle = `rgb(${r},${g},${b})`;
      x.strokeStyle = css.getPropertyValue("--ink");
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, 8, 0, 7);
      x.fill();
      x.stroke();
    }
  }, [list, scope, pick, cvRef]);
  React.useEffect(() => {
    if (view !== "color") return;
    draw();
    addEventListener("resize", draw);
    const watch = new MutationObserver(draw);
    watch.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
    });
    return () => {
      removeEventListener("resize", draw);
      watch.disconnect();
    };
  }, [view, draw]);
  const pickAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      k = (r.width / 2 - 6) / R;
    const u = (e.clientX - r.left - r.width / 2) / k,
      v = -(e.clientY - r.top - r.width / 2) / k;
    const again =
      pick &&
      Math.hypot(u - Math.cos(pick.a) * pick.c, v - Math.sin(pick.a) * pick.c) <
        10 / k;
    setPick(again ? null : { a: ang(u, v), c: Math.min(R, Math.hypot(u, v)) });
  };
  return pickAt;
}
