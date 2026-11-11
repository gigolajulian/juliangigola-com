"use client";

import * as React from "react";
import { matches } from "@/lib/device";

/* ── the focus field ──────────────────────────────────────────────
 * A hover that spans the gallery. One blurring layer (`.focus-field`,
 * globals.css) is laid over whichever gallery the pointer is in, clear
 * round the pointer: the frames near it come into focus and the rest go
 * out of it by degrees, the further the softer. One layer for every
 * gallery, moved with the pointer once a frame, so nothing in the
 * galleries themselves is touched.
 * ─────────────────────────────────────────────────────────────── */
const GALLERIES = ".light-table, .portfolio-arrive .strip-scroll, .contact-sheet";
const CELLS = ".light-cell, .strip-cell, .contact-sheet button";

export function FocusField() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = matches("fine");
    let frame = 0;
    let x = 0;
    let y = 0;
    let on: Element | null = null;
    const place = () => {
      frame = 0;
      if (!on) return void delete el.dataset.on;
      const r = on.getBoundingClientRect();
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.setProperty("--ff-x", `${x - r.left}px`);
      el.style.setProperty("--ff-y", `${y - r.top}px`);
      /* On the portfolio the discipline names between the runs stay
         sharp: each one in view is cut out of the mask. */
      const holes = [...on.querySelectorAll<HTMLElement>("[data-deck]")]
        .map((n) => n.getBoundingClientRect())
        .filter((h) => h.right > r.left && h.left < r.right);
      el.style.maskImage = ["var(--ff-mask)", ...holes.map(() => "linear-gradient(#000 0 0)")].join(", ");
      el.style.maskSize = ["100% 100%", ...holes.map((h) => `${h.width}px ${h.height}px`)].join(", ");
      el.style.maskPosition = ["0 0", ...holes.map((h) => `${h.left - r.left}px ${h.top - r.top}px`)].join(", ");
      el.style.maskRepeat = "no-repeat";
      el.style.maskComposite = ["subtract", ...holes.map(() => "add")].join(", ");
      el.dataset.on = "";
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const move = (e: PointerEvent) => {
      const mouse = e.pointerType === "mouse";
      if (mouse && !fine) return;
      x = e.clientX;
      y = e.clientY;
      const target = e.target as Element | null;
      // A mouse only; a finger got it only in the old menu.
      let g = mouse ? (target?.closest?.(GALLERIES) ?? null) : null;
      // Never over the inquiry form: picking a kind of shoot blurred the
      // screen round it.
      if (target?.closest("form, .contact-inquire")) g = null;
      // The clearing is a little wider than the frame under the pointer, so a
      // wide frame and a small one each come into focus whole.
      const cell = g ? target?.closest<HTMLElement>(CELLS) : null;
      if (cell && g?.contains(cell)) {
        // Half that on the portfolio, whose frames run the strip's full
        // height and are wide enough to clear the whole screen.
        const sharp = cell.offsetWidth * (g.matches(".portfolio-arrive .strip-scroll") ? 1.155 : 1.1);
        el.style.setProperty("--ff-sharp", `${Math.round(sharp)}px`);
      }
      on = g;
      soon();
    };
    const leave = () => {
      on = null;
      soon();
    };
    const lift = (e: PointerEvent) => e.pointerType !== "mouse" && leave();
    const scrolled = () => on && soon();
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", move, { passive: true });
    document.addEventListener("pointerup", lift);
    document.addEventListener("pointercancel", lift);
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scrolled, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", move);
      document.removeEventListener("pointerup", lift);
      document.removeEventListener("pointercancel", lift);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scrolled, { capture: true });
    };
  }, []);
  return <div ref={ref} aria-hidden className="focus-field" />;
}
