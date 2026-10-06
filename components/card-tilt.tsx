"use client";

import * as React from "react";

/* ── the card under the pointer tips toward it ────────────────────
 * Julian (2026-10-04): the Commissions table's cards (`.light-cell`), and
 * the same on the portfolio's projects. One listener for both: it writes
 * where the hand is on the card, and `globals.css` turns that into the
 * tilt, the lift and the shadow that falls away from the side that lifts.
 * The portfolio's chapter names are
 * words, not cards, and stay put.
 * ─────────────────────────────────────────────────────────────── */
const CARDS = ".light-cell, .portfolio-arrive .strip-cell:not([data-deck])";
const VARS = ["--rx", "--ry", "--rz", "--sx", "--sy"];
const TILT = 5;

export function CardTilt() {
  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let on: HTMLElement | null = null;
    const off = () => {
      if (on) for (const p of VARS) on.style.removeProperty(p);
      on = null;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(CARDS) ?? null;
      if (el !== on) off();
      if (!el) return;
      on = el;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${(x * TILT * 2).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-y * TILT * 2).toFixed(2)}deg`);
      // And a turn in its own plane (Julian: tilt on every axis), toward
      // the corner the pointer is in: a degree at most, or it reads as a spin.
      el.style.setProperty("--rz", `${(x * y * 4).toFixed(2)}deg`);
      el.style.setProperty("--sx", `${(-x * 12).toFixed(1)}px`);
      el.style.setProperty("--sy", `${(-y * 12).toFixed(1)}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", off);
    return () => {
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", off);
      off();
    };
  }, []);
  return null;
}
