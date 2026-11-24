import * as React from "react";
import Image from "next/image";
import { Orb } from "@/components/effects/orb";
import TiltedCard from "@/components/vendor/tilted-card";
import { cn } from "@/lib/utils";
import type { Frame } from "@/lib/work/work-types";
import { paintedCopy, rememberPainted } from "./painted";
import { useFit, type FitSize } from "./use-fit";
import type { SwipeHandlers } from "./use-swipe";
import { useZoom } from "./use-zoom";

/** The page's own picture of a frame, by its source. */
export const pictureFor = (src: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`img[data-frame="${CSS.escape(src)}"]`);

/* Every copy of a frame the viewer has painted, by frame. A step moves
   the middle picture to a side and a side one to the middle, each a new
   element that paints a frame late; the copy already painted goes under
   it, so nothing is blank for that frame. */
const notePainted = (src: string) => (e: React.SyntheticEvent<HTMLImageElement>) =>
  rememberPainted(src, e.currentTarget.currentSrc);
/** The best copy of a frame already decoded: the viewer's, or the page's. */
const decodedCopy = (src: string) => {
  const el = pictureFor(src);
  return paintedCopy(src) ?? (el instanceof HTMLImageElement ? el.currentSrc : "");
};
const sideUnder = (src: string) => {
  const url = decodedCopy(src);
  return url ? `url("${url}")` : undefined;
};

/* A step between frames (Julian: it snapped, smoothen). Was 650ms on an
   ease that ran seven tenths of the way in the first 150, which read as a
   jump; the new frame also started half transparent, a grey ghost over
   the one leaving. Longer, on an even ease-out, and opaque throughout. */
const STEP_MS = 900;
const STEP_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/** The clear space between the picture and a neighbour, in px. */
export const SIDE_GAP = 56;

/* Whole, never cropped, the 3D made elite, and not crowding the picture
   ("too close"). A cover flow: each neighbour smaller and set back, a
   clear gap from the picture, turned away from it on its inner edge,
   whole inside the window: shrunk to the room, gone below a sliver. */
/** A neighbour's box beside a picture fitted to `size`, or null when there is no room for one. */
export function sideSize(size: FitSize, frame: { width: number; height: number }): { w: number; h: number } | null {
  const room = size.vw / 2 - size.w / 2 - SIDE_GAP - 24;
  let h = size.h * 0.78;
  let w = (h * frame.width) / frame.height;
  const proj = () => w * 0.72; // its width on screen, turned
  if (proj() > room) {
    const k = room / proj();
    h *= k;
    w *= k;
  }
  if (room < 64) return null;
  return { w: Math.round(w), h: Math.round(h) };
}

/* Julian: a 3D card transition on a step. The new frame swings in from
   the side it was waiting at, turned as it was there (`.lightbox-side`),
   and lands flat. `dir` is 1 for a step forward, -1 back. */
export function swingStep(area: HTMLElement, dir: number) {
  const box = area.querySelector<HTMLElement>("[data-zoom-box]");
  if (!box) return;
  box.animate(
    [
      {
        /* Julian: natural and smooth. From about where the side
           photograph waited, turned as it was, easing out long. */
        transform: `perspective(1400px) translateX(${dir * 40}%) rotateY(${dir * 20}deg) scale(0.88)`,
      },
      { transform: "none" },
    ],
    { duration: STEP_MS, easing: STEP_EASE },
  );
  /* And the two either side move with it, as one carousel (Julian: the
     swap was not smooth; they vanished and faded back). The one behind
     the step is the picture that was in the middle: it leaves the middle
     flat and turns into its place. The one ahead glides in from past the
     edge. */
  const stage = area.getBoundingClientRect();
  for (const side of area.querySelectorAll<HTMLElement>(".lightbox-side")) {
    const turn = getComputedStyle(side).getPropertyValue("--turn").trim() || "0deg";
    const at = (x: string, z: string, r: string) =>
      `perspective(1400px) translateX(${x}) translateZ(${z}) rotateY(${r})`;
    const rest = at("0px", "-160px", turn);
    const behind = (side.dataset.side === "prev") === dir > 0;
    if (behind) {
      const b = side.getBoundingClientRect();
      const dx = stage.left + stage.width / 2 - (b.left + b.width / 2);
      side.animate([{ transform: at(`${dx}px`, "0px", "0deg") }, { transform: rest }], {
        duration: STEP_MS,
        easing: STEP_EASE,
      });
    } else {
      side.animate(
        [{ transform: at(`${dir * 60}%`, "-160px", turn), opacity: 0 }, { transform: rest, opacity: 1 }],
        { duration: STEP_MS, easing: STEP_EASE },
      );
    }
  }
}

export function Stage({
  frame,
  alt,
  pictureRef,
  swipe,
  sharp,
  onClose,
  prev,
  next,
  onStep,
  index,
}: {
  frame: Frame;
  alt: string;
  pictureRef: React.RefObject<HTMLDivElement | null>;
  swipe: SwipeHandlers;
  /** Whether the full-size copy may be put on the stage. */
  sharp: boolean;
  onClose: () => void;
  /** The frames before and after, shown at the edges; absent at the ends. */
  prev?: Frame;
  next?: Frame;
  onStep: (delta: number) => void;
  /** Where the frame is in the sequence: which way a step went. */
  index: number;
}) {
  const area = React.useRef<HTMLDivElement>(null);
  /** The index the last step swung from. Not on the first frame: the trip brings that one. */
  const swung = React.useRef(index);
  React.useEffect(() => {
    const dir = Math.sign(index - swung.current);
    swung.current = index;
    const el = area.current;
    if (!el || !dir || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    swingStep(el, dir);
  }, [index]);
  /* Which full-size copy has painted. By source, so a step to the next
     frame starts from the fitted picture again until its own arrives. */
  const [sharpDone, setSharpDone] = React.useState<string | null>(null);
  /* Which picture has painted, for the orb: by source, as above. */
  const [shown, setShown] = React.useState<string | null>(null);
  const size = useFit(area, frame.width, frame.height);
  const zoom = useZoom(pictureRef, frame.src, swipe);
  /* Under the picture while it arrives.
     The viewer asks for a wider copy than the strip did, so on a slow
     connection the file is still in flight when the trip starts: the
     press waits `DECODE_CAP_MS` and no longer, which would leave the box
     blank for the first few hundred ms. The copy the page already decoded is
     the same photograph and costs nothing, so it holds the box until the
     full one paints; the frame's own colour covers a frame that is not
     on the page, after a few arrow keys. */
  const under = React.useMemo(() => decodedCopy(frame.src), [frame.src]);
  return (
    <div
      ref={area}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-10"
    >
      {/* Julian: a thinking orb while the picture is still on its way.
          It waits a third of a second before it shows, so a picture that
          is already here never flashes one. */}
      {shown !== frame.src ? (
        <span className="orb-late pointer-events-none absolute bottom-4 right-4 z-10 text-foreground sm:bottom-6 sm:right-6">
          <Orb state="searching" size={20} />
        </span>
      ) : null}
      {/* What the finger moves. Stays mounted across a step, so the offset
          it was released at is where the next frame starts from. */}
      <div
        ref={pictureRef}
        data-ring={zoom.ring}
        {...zoom.pan}
        onClick={(e) => {
          if (zoom.dragged()) return;
          if (e.target === e.currentTarget) onClose();
        }}
        className="flex h-full w-full touch-none select-none items-center justify-center"
      >
        {/* The box the trip transforms: exactly the picture, clipped. */}
        <div
          data-zoom-box
          className={cn(
            // Over the neighbours tucked behind it.
            "relative z-20 shrink-0 bg-cover bg-center shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]",
            /* Clipped at its own edge while it is the size it was fitted
               to, and not once a wheel has been over it: a zoom is
               allowed the whole viewer, which on an upright photograph
               is most of the window either side of the frame. The stage
               clips instead (Julian's call). */
            zoom.scale === 1 && "overflow-hidden",
          )}
          style={{
            ...(size ? { width: size.w, height: size.h } : { width: 0, height: 0 }),
            backgroundColor: zoom.scale === 1 ? frame.color : "transparent",
            ...(under && zoom.scale === 1
              ? { backgroundImage: `url("${under}")` }
              : null),
          }}
        >
          <div style={zoom.style} className="relative h-full w-full">
          <Image
            key={frame.src}
            data-lightbox-picture
            src={frame.src}
            alt={alt}
            width={frame.width}
            height={frame.height}
            sizes="100vw"
            priority
            draggable={false}
            onLoad={(e) => {
              notePainted(frame.src)(e);
              setShown(frame.src);
            }}
            className="block h-full w-full object-contain"
          />
          {/* The zoomable copy: the master's full width at 82, laid exactly
              over the fitted picture once it has decoded, so the swap is
              invisible until a wheel goes in on it. The fitted picture is
              screen sized, and at three times it was soft. */}
          {sharp ? (
            <Image
              key={`sharp-${frame.src}`}
              src={frame.src}
              alt=""
              aria-hidden
              width={frame.width}
              height={frame.height}
              sizes="2500px"
              quality={82}
              draggable={false}
              onLoad={() => setSharpDone(frame.src)}
              className={cn(
                "absolute inset-0 block h-full w-full object-contain",
                sharpDone === frame.src ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
          </div>
        </div>
      </div>
      {/* Julian: the photograph before and the one after, at the picture's
          height, 24px off its edges and running off the window, blurred
          until the pointer is on one, which then says PREV or NEXT and
          steps there on a click. Julian: turned in 3D toward the picture,
          and tilting to the pointer as the Selected work tiles do. Not while zoomed, and not on a phone,
          where a swipe does it. Out of the tab order: the arrows below
          are the controls for that. They fade in on their own
          (`.lightbox-peek`), since one can arrive after a step. */}
      {size && zoom.scale === 1
        ? ([[-1, prev, "Prev"], [1, next, "Next"]] as const).map(([d, f, word]) => {
            if (!f) return null;
            const box = sideSize(size, f);
            if (!box) return null;
            return (
              <button
                key={word}
                type="button"
                tabIndex={-1}
                aria-label={d < 0 ? "Previous frame" : "Next frame"}
                data-ring={word}
                data-side={d < 0 ? "prev" : "next"}
                onClick={() => onStep(d)}
                className="lightbox-side absolute top-1/2 z-10 -translate-y-1/2 max-sm:hidden"
                style={{
                  width: box.w,
                  height: box.h,
                  [d < 0 ? "right" : "left"]: `calc(50% + ${Math.round(size.w / 2 + SIDE_GAP)}px)`,
                } as React.CSSProperties}
              >
                <TiltedCard
                  imageSrc={f.src}
                  altText=""
                  containerHeight="100%"
                  imageHeight="100%"
                  imageWidth="100%"
                  scaleOnHover={1.04}
                  showMobileWarning={false}
                  showTooltip={false}
                >
                  {/* Not keyed: the card stays through a step and moves
                      (above). The picture is, so a new one is never the old
                      one for a frame, and the copy the page already has is
                      under it until it paints, as under the middle one.
                      Over it a pane of glass, the picture sharp under it
                      (`.lightbox-glass`). */}
                  <span
                    className="lightbox-peek relative block h-full w-full overflow-hidden bg-cover bg-center"
                    style={{ backgroundImage: sideUnder(f.src) }}
                  >
                    <Image
                      key={f.src}
                      src={f.src}
                      alt=""
                      aria-hidden
                      width={f.width}
                      height={f.height}
                      sizes="50vw"
                      onLoad={notePainted(f.src)}
                      draggable={false}
                      className="absolute inset-0 block h-full w-full object-cover"
                    />
                    <span aria-hidden className="lightbox-glass" />
                  </span>
                </TiltedCard>
              </button>
            );
          })
        : null}
    </div>
  );
}
