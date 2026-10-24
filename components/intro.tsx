"use client";

import * as React from "react";
import { BlinkingMark } from "@/components/not-found-scene";
import loader from "@/image-loader";

/* ── the opening ──────────────────────────────────────────────────
 * A contact sheet. On the page's ground, a grid of frames on a tilted
 * plane fills in from the centre outward, each a grey card and then its
 * photograph, a counter in the corner; the plane settles toward flat as
 * it fills. Then the photographs whoosh up off the screen, top row
 * first so no row passes over another, fading as they go, while the
 * ground fades with them and the page is there underneath. Julian
 * picked it from the mock (Splash Options artifact, v8, 2026-10-24).
 *
 * Three rules it lives by, because an intro sits between a visitor and
 * the work:
 *
 *   It never holds the page for long. The site is rendered underneath
 *   from the first byte, and the whole opening takes about 3s from the
 *   moment the script runs, whatever is still loading. A frame whose
 *   photograph has not arrived stays a grey card.
 *
 *   It runs once a visit, on whichever page the visit starts on.
 *   `sessionStorage` remembers.
 *
 *   It is skipped for anybody who asks their system for less motion.
 *
 * All three decisions are made by the inline script in `layout.tsx`
 * before the first paint, and only under `?v3motion`. The stylesheet
 * keeps this layer hidden unless that script has set `data-intro`, so a
 * visitor with no JavaScript is never shut behind a curtain that cannot
 * lift.
 * ─────────────────────────────────────────────────────────────── */

/* Julian's picks, in fill order: the first lands in the centre. A phone
   shows the first 24, a tablet 30, a desktop all 32. */
const PICKS = [
  "/work/nyx/cover.jpg", "/work/omen/cover.jpg", "/work/vesper/cover.jpg", "/work/ghostlight/cover.jpg",
  "/work/echo-void/cover.jpg", "/work/vendetta/cover.jpg", "/work/liminal/cover.jpg", "/work/novocaine/cover.jpg",
  "/work/paranoia/cover.jpg", "/work/mirage/cover.jpg", "/work/threshold/cover.jpg", "/work/azure-bloom/cover.jpg",
  "/work/celestis/cover.jpg", "/work/cyberscape/cover.jpg", "/work/sonder/cover.jpg", "/hero/nyx-06.jpg",
  "/work/diesel/03.jpg", "/work/aegis/03.jpg", "/work/true-grit/01.jpg", "/work/valgur/06.jpg",
  "/work/novocaine/04.jpg", "/work/undisputed/04.jpg", "/work/goodcult/01.jpg", "/work/stratus-lookbook-vol-1/12.jpg",
  "/work/paradox/01.jpg", "/work/i-wanna-be-a-human/06.jpg", "/work/iris/07.jpg", "/work/paradox/02.jpg",
  "/work/oakley-x-nike/01.jpg", "/work/i-wanna-be-a-human/01.jpg", "/work/gilt/01.jpg", "/work/byte-me/17.jpg",
];

/* The grid per screen; the plane's inset and gap are in `splash.css`
   under the same breakpoints. */
const grid = () => (innerWidth < 700 ? [4, 6] : innerWidth < 1100 && innerHeight > innerWidth ? [5, 6] : [8, 4]);

const FILL = 1450; // every frame has started by then
const LAND = 360; // a card dropping onto the plane
const PHOTO = 260; // its photograph fading in, 150ms after the card
const PER = 620; // one frame's whoosh
const ROW = 45; // between rows on the way out, top first
const COL = 8; // between frames in a row
const S = "cubic-bezier(0.65, 0, 0.35, 1)";
const WHOOSH = "cubic-bezier(0.55, 0, 0.25, 1)";

const lift = () => document.documentElement.removeAttribute("data-intro");

/* Preview, `?splash=basic`: basicagency.com's opening, from the teardown
   in SITE TEARDOWN/basicagency. Timed and run before React, from the
   first paint: the inline script in `layout.tsx` moves `data-intro`
   along, the stylesheet plays every move (`splash.css`). Nothing here. */

/* Once per page load. React remounts effects in development, and a second
   take would start a sheet the first had already finished. */
let played = false;

export function Intro() {
  const box = React.useRef<HTMLDivElement>(null);
  const plane = React.useRef<HTMLDivElement>(null);
  const count = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1" || played) return;
    played = true;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    if (root.dataset.splash === "basic") return;
    const p = plane.current, layer = box.current;
    if (!p || !layer) return;

    const [cols, rows] = grid();
    const n = cols * rows;
    p.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    p.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    /* Julian: the frames at 4:5, and the sheet over the whole screen. The
       plane covers the window on whichever side runs short (a little over,
       so the tilt never shows an edge) and is cut at the window's edge. */
    {
      const W = innerWidth, H = innerHeight, g = parseFloat(getComputedStyle(p).columnGap) || 0;
      const cw = Math.max((W - (cols - 1) * g) / cols, ((H - (rows - 1) * g) / rows) * 0.8) * 1.06;
      const pw = cols * cw + (cols - 1) * g, ph = rows * cw * 1.25 + (rows - 1) * g;
      Object.assign(p.style, { width: `${pw}px`, height: `${ph}px`, left: `${(W - pw) / 2}px`, top: `${(H - ph) / 2}px`, right: "auto", bottom: "auto" });
    }
    const cells = Array.from({ length: n }, () => {
      const cell = document.createElement("div");
      cell.className = "jg-sheet-cell";
      cell.append(document.createElement("img"));
      p.append(cell);
      return cell;
    });
    if (count.current) count.current.nextSibling!.textContent = ` / ${String(n).padStart(3, "0")}`;

    /* Centre outward, measured on the flat grid before it tilts. */
    const r0 = p.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    const order = cells
      .map((c, i) => {
        const r = c.getBoundingClientRect();
        return [Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy), i] as const;
      })
      .sort((a, b) => a[0] - b[0]);

    const step = FILL / n;
    const fill = (n - 1) * step + LAND + 50;
    p.animate(
      [
        { transform: "translateZ(-120px) rotateX(28deg) rotateZ(-7deg)" },
        { transform: "translateZ(0) rotateX(12deg) rotateZ(-3deg)" },
      ],
      { duration: fill, easing: "cubic-bezier(0.25, 0.6, 0.3, 1)", fill: "forwards" },
    );
    order.forEach(([, i], k) => {
      const cell = cells[i], img = cell.firstChild as HTMLImageElement;
      img.alt = "";
      img.decoding = "async";
      img.src = loader({ src: PICKS[k % PICKS.length], width: 384 });
      cell.animate(
        [{ opacity: 0, transform: "translateZ(160px) scale(0.9)" }, { opacity: 1, transform: "none" }],
        { duration: LAND, delay: k * step, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)", fill: "forwards" },
      );
      img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PHOTO, delay: k * step + 150, fill: "forwards" });
      setTimeout(() => {
        if (count.current) count.current.textContent = String(k + 1).padStart(3, "0");
      }, k * step + 150);
    });

    /* Out: top row first, so a lower row never catches the one above. */
    const out = fill + 160;
    const total = (rows - 1) * ROW + cols * COL + PER;
    const h = innerHeight * 1.3;
    cells.forEach((cell, i) => {
      const delay = out + Math.floor(i / cols) * ROW + (i % cols) * COL;
      cell.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-h}px)` }],
        { duration: PER, delay, easing: WHOOSH, fill: "forwards", composite: "add" });
      cell.animate([{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
        { duration: PER, delay, easing: S, fill: "forwards" });
    });
    layer.querySelector(".jg-sheet-count")?.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: PER, delay: out, easing: S, fill: "forwards" });
    /* Julian: the ground holds while the photographs leave and fades once
       the last row is half way up, so it reads as one move. */
    const clear = out + (rows - 1) * ROW + (cols - 1) * COL + PER * 0.5;
    const CLEAR = 520;
    layer.querySelector(".jg-sheet-ground")?.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: CLEAR, delay: clear, easing: S, fill: "forwards" });
    /* The page's entrance sets off as the ground starts to clear
       (`half` unpauses it, `splash.css`), and the pointer goes through. */
    setTimeout(() => {
      root.dataset.intro = "half";
      root.dataset.splashed = "";
      layer.classList.add("jg-intro-open");
    }, clear);
    /* No cleanup: React's development remount would clear these, and
       `played` stops the second take from setting them again. */
    setTimeout(lift, Math.max(out + total, clear + CLEAR));
  }, []);

  return (
    <>
      {/* The one rule that cannot wait for the stylesheet. The layer is in
          the server's HTML and the styles are in separate files, so there
          is a window between the document arriving and the CSS applying
          in which it has no rules at all and would lay itself out in the
          flow. Carried inline it is there from the first byte, and
          `[data-intro] #jg-intro` in the stylesheet still wins on
          specificity when it comes. */}
      <style>{"#jg-intro{display:none}"}</style>
      <div id="jg-intro" ref={box} aria-hidden="true">
        <div className="jg-sheet-ground" />
        <div ref={plane} className="jg-sheet-plane" />
        <div className="jg-sheet-count">
          <span ref={count}>000</span>
          <span> / 000</span>
        </div>
        <div className="jg-intro-eye">
          <BlinkingMark still />
        </div>
      </div>
    </>
  );
}
