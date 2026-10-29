import Image from "next/image";
import type { Bts, Frame } from "@/lib/work-types";

/* Behind the scenes: the plate that names who shot it, and the grid of
   frames. On a project page they sit after the last frame, before the end
   cell (`project-strip.tsx`); on /bts every shoot gets one of each. The
   photo tiles are all cropped 4:3 so the grid reads as a contact sheet and
   not as a second sequence competing with the work; clips keep their shape. Photos show in black and white
   (the files stay in color); clips keep their color. */

const pad = (n: number) => String(n).padStart(2, "0");

/** "04 frames · 01 clip": photos and clips counted apart, an empty kind left out. */
const count = (bts: Bts) => {
  const clips = bts.frames.filter((f) => f.src.endsWith(".mp4")).length;
  const photos = bts.frames.length - clips;
  return [
    photos ? `${pad(photos)} ${photos === 1 ? "frame" : "frames"}` : "",
    clips ? `${pad(clips)} ${clips === 1 ? "clip" : "clips"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

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
            className="-my-[15px] inline-block py-[15px] text-foreground transition-opacity duration-200 hoverable:hover:opacity-70"
          >
            @{bts.by}
          </a>
        </p>
      ) : null}
      <p className="label tabular-nums text-muted-foreground">
        {count(bts)}
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
  // Clips keep their own shape, uncropped; photos stay on the 4:3 sheet.
  const clip = frame.src.endsWith(".mp4");
  return (
    <div
      className={`relative overflow-hidden ${clip ? "" : "aspect-[4/3]"} ${className}`}
      style={{
        backgroundColor: frame.color,
        ...(clip ? { aspectRatio: `${frame.width} / ${frame.height}` } : {}),
      }}
    >
      {clip ? (
        <video
          src={frame.src}
          poster={frame.src.replace(/\.mp4$/, ".poster.jpg")}
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
          className="object-cover grayscale"
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
          // A vertical clip stands the full height of the strip, both rows.
          className={`sm:h-full ${
            f.src.endsWith(".mp4") && f.height > f.width ? "sm:row-span-2" : ""
          }`}
        />
      ))}
    </div>
  );
}

/** A grid down the page, for /bts. */
export function BtsPageGrid({ bts, name }: { bts: Bts; name: string }) {
  return (
    <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
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
