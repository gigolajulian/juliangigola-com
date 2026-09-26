"use client";

import * as React from "react";
import DriftWall from "@/components/DriftWall";
import type { WallTile } from "@/lib/work";

/* ── the opening ──────────────────────────────────────────────────
 * A wall of the work drifting in perspective (React Bits' `DriftWall`),
 * the featured projects first, with a loader in the middle that fills
 * with the page getting ready. At 100 the wall fades and the page makes
 * its own entrance.
 *
 * Three rules it lives by, because an intro sits between a visitor and
 * the work:
 *
 *   It never holds the page for long. The site is rendered underneath
 *   from the first byte, and the layer gives up at `CAP` whatever is
 *   still loading: a slow phone is not kept at the door for the last
 *   photograph.
 *
 *   It runs once a visit, not once a page. `sessionStorage` remembers,
 *   so moving between Work and Sessions never replays it.
 *
 *   It is skipped for anybody who asks their system for less motion.
 *
 * All three decisions are made by the inline script in `layout.tsx`
 * before the first paint, which is the only place they can be made
 * without a frame of the site showing first. The stylesheet keeps this
 * layer hidden unless that script has set `data-intro`, so a visitor
 * with no JavaScript is never shut behind a curtain that cannot lift.
 * ─────────────────────────────────────────────────────────────── */

const CAP = 6000; // the longest anybody waits, whatever is still loading
const SHOW = 600; // the wall fading in
const FILL = 3500; // the loader's steady fill, when the page is quicker
const HIDE = 150; // the loader going, a beat before the wall does
const LIFT = 900; // the wall dissolving into the page as it arrives

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const lift = () => document.documentElement.removeAttribute("data-intro");

/* Once per page load. React remounts effects in development, and a second
   take would start a loader the first had already finished. */
let played = false;

export function Intro({ tiles }: { tiles: WallTile[] }) {
  const box = React.useRef<HTMLDivElement>(null);
  const mark = React.useRef<HTMLDivElement>(null);
  const bar = React.useRef<HTMLDivElement>(null);
  const count = React.useRef<HTMLSpanElement>(null);
  /* The wall, mounted only while the intro plays: two dozen pictures on
     every page load for a layer that is not showing would be waste. Its
     tiles here are not links (no `href`): the layer is a curtain, and a
     press on it must not start a page change under it. */
  const [wall, setWall] = React.useState(false);
  const still = React.useMemo(
    () => tiles.map(({ image, title }) => ({ image, title })),
    [tiles],
  );

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1" || played) return;
    played = true;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    /* What "ready" means: the type, every photograph already on screen
       that is not lazy, and the window's own load. The line fills on a
       steady curve over `FILL` and never runs ahead of those: a quick page
       gets the smooth fill, a slow one waits at what has really come. */
    const tasks: Promise<unknown>[] = [document.fonts.ready];
    if (document.readyState !== "complete") {
      tasks.push(
        new Promise((r) => window.addEventListener("load", r, { once: true })),
      );
    }
    for (const img of Array.from(document.images)) {
      if (img.complete || img.loading === "lazy") continue;
      if (img.getBoundingClientRect().top > window.innerHeight) continue;
      tasks.push(
        new Promise((r) => {
          img.addEventListener("load", r, { once: true });
          img.addEventListener("error", r, { once: true });
        }),
      );
    }
    let done = 0;
    for (const t of tasks) t.then(() => done++);

    const t0 = performance.now();
    let shown = 0;
    let wallOn = false;
    const step = (now: number) => {
      if (!wallOn) {
        wallOn = true;
        setWall(true);
      }
      // A frame's time can be a touch before `t0`: never below nought.
      const since = Math.max(0, now - t0);
      const real = done / tasks.length;
      const target =
        since >= CAP ? 1 : Math.min(real, Math.min(1, since / FILL));
      shown += (target - shown) * 0.2;
      if (target - shown < 0.001) shown = target;

      if (mark.current)
        mark.current.style.opacity = String(
          easeOut(Math.min(1, since / SHOW)),
        );
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
      if (count.current) {
        count.current.textContent = String(Math.round(shown * 100)).padStart(
          3,
          "0",
        );
      }
      if (shown !== 1) {
        requestAnimationFrame(step);
        return;
      }
      box.current?.classList.add("jg-intro-leaving");
      setTimeout(() => {
        root.dataset.intro = "lift";
        setTimeout(() => {
          lift();
          setWall(false);
        }, LIFT);
      }, HIDE);
    };
    requestAnimationFrame(step);
    /* No cleanup. The loader is a one-shot that ends on its own inside
       `CAP`, and cancelling it on unmount would stop it dead in
       development, where React mounts an effect twice and the guard above
       keeps the second mount from starting it again. */
  }, []);

  return (
    <>
      {/* The one rule that cannot wait for the stylesheet. The layer is in
          the server's HTML and the styles are in separate files, so there
          is a window between the document arriving and the CSS applying
          in which it has no rules at all and would lay itself out in the
          flow. Carried inline it is there from the first byte, and
          `[data-intro] #jg-intro` in the stylesheet still wins on
          specificity when it comes.

          The attribute `hidden` would be shorter and is wrong: the user
          agent writes that rule with `!important`, which no author rule
          can beat, and the opening never plays at all. */}
      <style>{"#jg-intro{display:none}"}</style>
      <div id="jg-intro" ref={box} aria-hidden="true">
        <div ref={mark} className="jg-intro-mark">
          {wall && (
            <DriftWall
              items={still}
              columns="fill"
              tileWidth={300}
              tileHeight={400}
              gap={28}
              radius={4}
              tilt={16}
              turn={-14}
              perspective={1200}
              depth={120}
              speed={42}
              direction="up"
              variance={0.45}
              parallax={0.6}
              lift={64}
              fade={0.6}
              dim={0.55}
              overlayColor="#0b0a09"
            />
          )}
        </div>
        <div className="jg-intro-load">
          <span ref={count} className="label tabular-nums">
            000
          </span>
          <div className="jg-intro-track">
            <div ref={bar} />
          </div>
        </div>
      </div>
    </>
  );
}
