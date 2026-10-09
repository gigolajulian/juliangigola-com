"use client";

import * as React from "react";
import { useDialKit } from "dialkit";
import DriftWall from "@/components/DriftWall";
import type { WallTile } from "@/lib/work";

/* The photo wall behind the homepage's last page, on its own DialKit
   panel. Julian: a dial for its scale. 1 is the wall at its full size
   (300 by 400 tiles); the gap and the drift scale with it so it reads as
   the same motion at any size. The panel mounts with the hero's, on the
   dev server only; production gets the default. */
export function InquireWall({ items }: { items: WallTile[] }) {
  /* And its tint (Julian: lower it). One dial for the two layers that
     darken it: the tiles' own opacity and the veil of the page colour
     over each. 0.6 is how it first shipped, tiles at 0.4 under a 0.42
     veil; 0 is the photographs at full strength. */
  const { scale, tint } = useDialKit(
    "Background wall",
    { scale: [0.85, 0.2, 2, 0.05], tint: [0.2, 0, 1, 0.01] },
    { id: "inquire-wall" },
  );
  /* Julian: a dial for the blur on the two doors to the right of the
     ask, frosted over this wall. It reaches them as `--door-blur`, which
     their class reads with the same 2px as its fallback. */
  const { blur } = useDialKit(
    "Right cards",
    { blur: [1, 0, 24, 0.5] },
    { id: "inquire-doors" },
  );
  React.useEffect(() => {
    document.getElementById("where-next")?.style.setProperty("--door-blur", `${blur}px`);
  }, [blur]);

  /* Built on the screen before it, not with the page. Julian:
     a first visit lagged until everything had loaded. The wall is 144
     tiles in 3D, each a layer of its own, and on the homepage it is the
     last of five screens: built with the page it was a good part of the
     first layout and the hydration, and its layers were carried through
     every frame of the four screens before it. Along the strip, or down
     the page on a phone; a link straight to #inquire builds it at once.
     Once the scrolling has stopped: built during a page turn, it dropped
     half a dozen frames of it. Not in a transition, which here runs the
     whole page through a view transition (`page-transition.tsx`). */
  const box = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  /* Two ways to lighten the wall on a large screen, on trial behind
     `?wall=` (plan 1.1; at 1920 by 1080 Inquiries and the booking page
     ran at 4 to 12fps in WebKit). `slow`: on a screen 1600px wide or
     more, a slower drift, bigger tiles so there are fewer columns and
     fewer tiles, and the same small file stretched over each. `still`:
     the wall holds while a field of the form has focus or the pointer
     is on the card, and drifts again 2 seconds after. Read once, on the
     first client render; the server renders the wall as it always was. */
  const [flag] = React.useState(() => {
    if (typeof location === "undefined") return { slow: false, still: false };
    const q = new URLSearchParams(location.search).get("wall");
    return { slow: q === "slow" && matchMedia("(min-width: 1600px)").matches, still: q === "still" };
  });
  /* The screen the wall is behind, kept from before it is built: the
     placeholder is the only element of ours in the page until then. */
  const scope = React.useRef<HTMLElement | null>(null);
  const [hold, setHold] = React.useState(false);
  React.useEffect(() => {
    if (!flag.still || !near) return;
    const card = (scope.current ?? document).querySelector<HTMLElement>(".contact-card");
    if (!card) return;
    let over = false;
    let resume = 0;
    const field = (el: Element | null) =>
      !!el && card.contains(el) && el.matches("input, textarea, select, [contenteditable], iframe");
    const update = (focused: Element | null) => {
      clearTimeout(resume);
      if (over || field(focused)) setHold(true);
      else resume = window.setTimeout(() => setHold(false), 2000);
    };
    const enter = () => {
      over = true;
      update(document.activeElement);
    };
    const leave = () => {
      over = false;
      update(document.activeElement);
    };
    const focusIn = (e: FocusEvent) => update(e.target as Element);
    const focusOut = (e: FocusEvent) => update(e.relatedTarget as Element | null);
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focusin", focusIn);
    card.addEventListener("focusout", focusOut);
    return () => {
      clearTimeout(resume);
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("focusin", focusIn);
      card.removeEventListener("focusout", focusOut);
    };
  }, [flag.still, near]);
  React.useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    scope.current = el.closest<HTMLElement>(".contact-inquire");
    const strip = el.closest<HTMLElement>(".strip-scroll");
    const root = strip && getComputedStyle(strip).overflowX !== "visible" ? strip : null;
    const scroller: EventTarget = root ?? window;
    let still = 0;
    const build = () => setNear(true);
    const moved = () => {
      clearTimeout(still);
      still = window.setTimeout(build, 200);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        scroller.addEventListener("scroll", moved, { passive: true });
        moved();
      },
      // Half a screen: an edge that only touches the margin counts, so a
      // whole one built it two screens early.
      { root, rootMargin: "50% 50%" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(still);
      scroller.removeEventListener("scroll", moved);
    };
  }, [near]);
  if (!near) return <div ref={box} className="h-full w-full" />;

  // `?wall=slow` on a large screen: the tiles a third bigger, half the
  // speed, and fewer photographs, each at a lower density so the small
  // file still serves.
  const k = flag.slow ? 1.35 : 1;

  return (
    <DriftWall
      items={items}
      className="inquire-wall"
      columns="fill"
      /* Julian (2026-10-08): scaled out so more of the work shows (1.25
         to 0.85), and no more than 24 photographs loaded for it however
         wide the screen, so it stays light. */
      limit={flag.slow ? 18 : 24}
      /* And the small copies (Julian: lower the resolution, not so it
         shows). A 255px tile on a 2x screen took the 640 file; at 0.6 it
         takes the 320, a quarter of the pixels to decode and hold for
         every tile, on a wall that is dimmed, tilted, moving and mostly
         under the frosted card. */
      density={flag.slow ? 0.45 : 0.6}
      tileWidth={Math.round(300 * scale * k)}
      tileHeight={Math.round(400 * scale * k)}
      gap={Math.round(28 * scale * k)}
      radius={8}
      tilt={16}
      turn={-14}
      perspective={1200}
      depth={120}
      /* Julian (2026-10-05): a third slower (was 24). */
      speed={16 * scale * (flag.slow ? 0.5 : 1)}
      hold={hold}
      direction="up"
      variance={0.45}
      parallax={0.6}
      lift={16}
      fade={0}
      dim={1 - tint}
      style={{ "--dw-veil": tint * 0.7 }}
      overlayColor="var(--background)"
    />
  );
}
