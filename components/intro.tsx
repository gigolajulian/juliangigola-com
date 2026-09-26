"use client";

import * as React from "react";
import DriftWall from "@/components/DriftWall";
import CountUp from "@/components/CountUp";
import { BlinkingMark, blink } from "@/components/not-found-scene";
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

const CAP = 6200; // the longest anybody waits, whatever is still loading
const SHOW = 600; // the wall fading in
const FILL = 3700; // the loader's steady fill, when the page is quicker; Julian: 0.2s longer
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
  const feed = React.useRef<(n: number) => void>(() => {});
  const eye = React.useRef<HTMLDivElement>(null);
  /* The wall, mounted only while the intro plays: two dozen pictures on
     every page load for a layer that is not showing would be waste. Its
     tiles here are not links (no `href`): the layer is a curtain, and a
     press on it must not start a page change under it. */
  /* How many photographs the wall is given: as many as the screen shows,
     not the whole archive. `DriftWall` fills the width with a column per
     tile width and a half again for the swing of the plane, and splits
     the pictures across its columns when each gets four or more; four a
     column is the least that keeps every column its own. An iPad is five
     columns, twenty pictures; a wide desktop eleven. Julian: it does not
     need to load as many photos as a large screen. Nought is no wall. */
  const [wall, setWall] = React.useState(0);
  /* The wall takes the theme the head script chose before the first paint:
     a visitor whose system is light no longer gets a dark curtain over a
     light site. Read once, when the wall mounts. */
  const [light, setLight] = React.useState(false);
  const still = React.useMemo(
    () => tiles.slice(0, wall).map(({ image, title }) => ({ image, title })),
    [tiles, wall],
  );
  /* The wall says when its photographs in view are up, and the loader
     counts that among what "ready" means, so a slow connection gets the
     wall and not a bare counter. */
  const wallUp = React.useRef<() => void>(() => {});

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
    const tasks: Promise<unknown>[] = [
      document.fonts.ready,
      new Promise<void>((r) => (wallUp.current = r)),
    ];
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

    /* The eye blinks twice: once as the wall settles in, and once as the
       count closes on 100, so its lids come down as the wall lets go. */
    const lids = () => eye.current?.querySelector("[data-lids]");
    let blinks = 0;

    const t0 = performance.now();
    let shown = 0;
    let fed = 0;
    let wallOn = false;
    const step = (now: number) => {
      if (!wallOn) {
        wallOn = true;
        const columns = Math.max(5, Math.ceil((innerWidth * 1.5) / (300 + 28)));
        setLight(root.dataset.theme === "light");
        setWall(columns * 4);
      }
      // A frame's time can be a touch before `t0`: never below nought.
      const since = Math.max(0, now - t0);
      const real = done / tasks.length;
      const target =
        since >= CAP ? 1 : Math.min(real, Math.min(1, since / FILL));
      shown += (target - shown) * 0.2;
      if (target - shown < 0.001) shown = target;

      if (mark.current)
        mark.current.style.opacity = String(easeOut(Math.min(1, since / SHOW)));
      if (bar.current)
        bar.current.style.clipPath = `inset(0 ${(1 - shown) * 100}% 0 0 round 9999px)`;
      // Julian: the eye comes up with the line, from nothing to full.
      if (eye.current) eye.current.style.opacity = String(shown);
      const l = lids();
      if (l && blinks === 0 && since >= 1400) {
        blinks = 1;
        blink(l);
      }
      if (l && blinks === 1 && shown >= 0.96) {
        blinks = 2;
        blink(l);
      }
      /* The count is React Bits' CountUp, rolling on a spring that trails
         its target by a tenth of a second or so. It is given the line's
         target that far ahead, never past what has really loaded, and the
         wall waits for it to read 100 so it never leaves on 097. */
      const ahead =
        since >= CAP ? 1 : Math.min(real, Math.min(1, (since + 120) / FILL));
      const pct = Math.round(ahead * 100);
      if (pct !== fed) {
        fed = pct;
        feed.current(pct);
      }
      const counted =
        count.current?.textContent === "100" || since >= CAP + 1000;
      if (shown !== 1 || !counted) {
        requestAnimationFrame(step);
        return;
      }
      box.current?.classList.add("jg-intro-leaving");
      setTimeout(() => {
        root.dataset.intro = "lift";
        setTimeout(() => {
          lift();
          setWall(0);
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
          {wall > 0 && (
            <DriftWall
              items={still}
              eager
              onShown={() => wallUp.current()}
              columns="fill"
              tileWidth={300}
              tileHeight={400}
              gap={28}
              radius={4}
              tilt={16}
              turn={-14}
              perspective={1200}
              depth={120}
              speed={34}
              direction="up"
              variance={0.45}
              parallax={0.6}
              lift={16}
              fade={0.6}
              dim={light ? 0.7 : 0.55}
              overlayColor={light ? "#ebedef" : "#0b0a09"}
            />
          )}
        </div>
        {/* Julian: the count in the middle, the eye at the foot, and the
            line along the bottom edge. */}
        <div ref={eye} className="jg-intro-eye" style={{ opacity: 0 }}>
          <BlinkingMark still />
        </div>
        <div className="jg-intro-load">
          <span ref={count} className="jg-intro-count tabular-nums">
            <LoaderCount feedRef={feed} />
          </span>
        </div>
        {/* The line along the foot of the screen, edge to edge. */}
        <div className="jg-intro-track">
          <div ref={bar} />
        </div>
      </div>
    </>
  );
}

/* The count on its own, so a new target re-renders a number and not the
   wall of photographs around it. */
function LoaderCount({
  feedRef,
}: {
  feedRef: React.RefObject<(n: number) => void>;
}) {
  const [to, setTo] = React.useState(0);
  React.useEffect(() => {
    feedRef.current = setTo;
  }, [feedRef]);
  // Critically damped: rolls between numbers and lands without creeping.
  return <CountUp to={to} stiffness={300} damping={35} />;
}
