"use client";

import { useDialKit } from "dialkit";
import DriftWall from "@/components/DriftWall";
import type { WallTile } from "@/lib/work";

/* The photo wall behind the homepage's last page, on its own DialKit
   panel. Julian: a dial for its scale. 1 is the wall at its full size
   (300 by 400 tiles); the gap and the drift scale with it so it reads as
   the same motion at any size. The panel mounts with the hero's, on the
   dev server only; production gets the default. */
export function InquireWall({ items }: { items: WallTile[] }) {
  const { scale } = useDialKit(
    "Background wall",
    { scale: [1.15, 0.2, 2, 0.05] },
    { id: "inquire-wall" },
  );
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
      dim={0.4}
      overlayColor="var(--background)"
    />
  );
}
