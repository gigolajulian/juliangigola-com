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
    { scale: [1.25, 0.2, 2, 0.05], tint: [0.37, 0, 1, 0.01] },
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
  React.useEffect(() => {
    const el = box.current;
    if (!el || near) return;
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

  return (
    <DriftWall
      items={items}
      className="inquire-wall"
      columns="fill"
      tileWidth={Math.round(300 * scale)}
      tileHeight={Math.round(400 * scale)}
      gap={Math.round(28 * scale)}
      radius={8}
      tilt={16}
      turn={-14}
      perspective={1200}
      depth={120}
      speed={24 * scale}
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
