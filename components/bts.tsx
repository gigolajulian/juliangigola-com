import Image from "next/image";
import type { Bts, Frame } from "@/lib/work-types";

/* Behind the scenes: the plate that names who shot it, and the grid of
   frames. On a project page they sit after the last frame, before the end
   cell (`project-strip.tsx`); on /bts every shoot gets one of each. The
   tiles are all cropped 4:3 so the grid reads as a contact sheet and not as
   a second sequence competing with the work. */

const pad = (n: number) => String(n).padStart(2, "0");

export function BtsCredit({ bts }: { bts: Bts }) {
  return (
    <>
      {bts.by ? (
        <p className="label text-muted-foreground">
          BTS by{" "}
          <a
            href={`https://instagram.com/${bts.by}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-my-2 inline-block py-2 text-foreground transition-opacity duration-200 hoverable:hover:opacity-70"
          >
            @{bts.by}
          </a>
        </p>
      ) : null}
      <p className="label tabular-nums text-muted-foreground">
        {pad(bts.frames.length)} frames
      </p>
    </>
  );
}

function Tile({
  frame,
  name,
  n,
  sizes,
  className = "",
}: {
  frame: Frame;
  name: string;
  n: number;
  sizes: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[4/3] overflow-hidden ${className}`}
      style={{ backgroundColor: frame.color }}
    >
      {frame.src.endsWith(".mp4") ? (
        <video
          src={frame.src}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          aria-label={frame.alt || `${name}, behind the scenes, clip ${n}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          src={frame.src}
          alt={frame.alt || `${name}, behind the scenes, frame ${n}`}
          fill
          sizes={sizes}
          loading="lazy"
          data-fade=""
          className="object-cover"
        />
      )}
    </div>
  );
}

/** Two rows that run sideways on the strip, two columns down a phone. */
export function BtsStripGrid({ bts, name }: { bts: Bts; name: string }) {
  return (
    <div
      data-hash="bts-frames"
      data-tick
      className="grid shrink-0 grid-cols-2 gap-2 max-sm:w-full sm:h-full sm:auto-cols-max sm:grid-flow-col sm:grid-cols-none sm:grid-rows-2 sm:gap-3"
    >
      {bts.frames.map((f, i) => (
        <Tile
          key={f.src}
          frame={f}
          name={name}
          n={i + 1}
          sizes="(min-width: 40rem) 30vw, 50vw"
          className="sm:h-full"
        />
      ))}
    </div>
  );
}

/** A grid down the page, for /bts. */
export function BtsPageGrid({ bts, name }: { bts: Bts; name: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
      {bts.frames.map((f, i) => (
        <Tile
          key={f.src}
          frame={f}
          name={name}
          n={i + 1}
          sizes="(min-width: 80rem) 20vw, (min-width: 40rem) 30vw, 50vw"
        />
      ))}
    </div>
  );
}
