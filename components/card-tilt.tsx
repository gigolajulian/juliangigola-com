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
const CARDS = ".light-cell, .portfolio-arrive .strip-cell:not([data-deck]), .scope-tile";
const VARS = ["--rx", "--ry", "--rz", "--sx", "--sy", "--cx", "--cy"];
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
      if (el !== on) {
        /* The card's own middle, from wherever its origin is: the deck
           (`lib/deck.ts`) moves a portfolio cell's origin to the screen's
           middle for its recede, and turned about that the tilt threw the
           card wide across its neighbours (Julian, 2026-10-08). */
        const [ox, oy] = getComputedStyle(el).transformOrigin.split(" ").map(parseFloat);
        el.style.setProperty("--cx", `${(el.offsetWidth / 2 - ox).toFixed(1)}px`);
        el.style.setProperty("--cy", `${(el.offsetHeight / 2 - oy).toFixed(1)}px`);
      }
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
    /* While anything scrolls, and a beat after, no card lifts (`globals.css`). */
    const root = document.documentElement;
    let still = 0;
    const scrolled = () => {
      if (!("scrolling" in root.dataset)) root.dataset.scrolling = "";
      clearTimeout(still);
      still = window.setTimeout(() => delete root.dataset.scrolling, 150);
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("scroll", scrolled, { passive: true, capture: true });
    document.documentElement.addEventListener("pointerleave", off);
    return () => {
      clearTimeout(still);
      delete root.dataset.scrolling;
      document.removeEventListener("scroll", scrolled, { capture: true });
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", off);
      off();
    };
  }, []);
  return null;
}
