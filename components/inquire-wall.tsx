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
    { scale: [1.15, 0.2, 2, 0.05], tint: [0.45, 0, 1, 0.01] },
    { id: "inquire-wall" },
  );
  /* Julian: a dial for the blur on the two doors to the right of the
     ask, frosted over this wall. It reaches them as `--door-blur`, which
     their class reads with the same 2px as its fallback. */
  const { blur } = useDialKit(
    "Right cards",
    { blur: [2, 0, 24, 0.5] },
    { id: "inquire-doors" },
  );
  React.useEffect(() => {
    document.getElementById("where-next")?.style.setProperty("--door-blur", `${blur}px`);
  }, [blur]);
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
