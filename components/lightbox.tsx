"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { Dialog, VisuallyHidden } from "radix-ui";
import { cn, rubberband } from "@/lib/utils";
import type { Frame } from "@/lib/work-types";

/* ── the lightbox ─────────────────────────────────────────────────
 * A frame at the size of the screen, paged with the arrow keys.
 *
 * Shared by the project galleries and the cover-art sheet: those two lay
 * their frames out very differently, but what happens when you click one is
 * the same, and it is the part with the keyboard handling and the focus
 * behaviour in it.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Which frame is open, and how it got there.
 *
 * A hook rather than state inside `Lightbox`, because the thing that opens it
 * is whatever the surrounding layout happens to be — a row of paired frames,
 * a grid of covers — and that has to stay the caller's business.
 */
/* ── the trip ─────────────────────────────────────────────────────
 * Pressing a frame does not open a dialog over it. The frame lifts off the
 * page and grows to the middle of the screen; closing sends it back.
 *
 * The browser's View Transitions API directly, not React's `<ViewTransition>`
 * — and the difference is the point. React's component pairs a name that is
 * *unmounting* with one that is *mounting*, which is what a route change is.
 * Here the frame in the gallery stays on the page under the lightbox, so
 * both ends exist at once and React refuses the pair as a duplicate. The
 * browser has no such rule: it captures a snapshot, runs the update, and
 * captures another, and a name is allowed to be on one element before and a
 * different element after. So the name is put on the pressed picture, moved
 * to the lightbox's picture inside the update, and taken off afterwards.
 *
 * Every frame that can open carries `data-frame` with its path, which is how
 * the one to lift — or land in — is found. The route morph on the project's
 * first frame (`cover-<slug>`, see `gallery.tsx`) is React's and untouched:
 * that one crosses pages, and this one never does.
 * ─────────────────────────────────────────────────────────────── */

/** The one name the trip uses. On one element at a time, by construction. */
const NAME = "lightbox-frame";

const pictureFor = (src: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`img[data-frame="${CSS.escape(src)}"]`);

/** The layout the frame lifts out of, when it spreads; see `travel`. */
const STAGE = "lightbox-stage";

/**
 * Runs `update` as a view transition with the name travelling from `from`
 * to `to`. Either end may be absent; the lightbox's own picture carries the
 * name in its style, so it is never passed here. Without the API, or with
 * reduced motion, the update simply runs.
 *
 * `stage`, when given, is the layout the frame is lifted out of — the
 * filmstrip. It is named on the side of the trip where the lightbox is
 * closed and only there, so the browser sees it leave on the way in and
 * arrive on the way out, and `globals.css` scales it about the pressed
 * frame: the neighbours spread away from the one that is growing, and
 * gather back round it on the way home. Julian's reference for this is
 * remyshoots.co.za, studied frame by frame. The origin is handed over as a
 * custom property on the root, which the transition pseudo-elements
 * inherit.
 */
function travel(
  from: HTMLElement | null,
  update: () => void,
  to: HTMLElement | null,
  stage?: HTMLElement | null,
) {
  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }
  if (from) from.style.viewTransitionName = NAME;
  const anchor = from ?? to;
  if (stage && anchor) {
    const r = anchor.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--lift-x",
      `${r.left + r.width / 2 - s.left}px`,
    );
  }
  // Named while closed (the old side going in, the new side coming out),
  // never while open: a named element is drawn above the root snapshot, so
  // named on the open side it would show through the lightbox's overlay for
  // the length of the trip.
  if (stage && from) stage.style.viewTransitionName = STAGE;
  // Says which trip this is, so the root's crossfade can be a plain fade
  // off a page that never moved. See `[data-lift]` in `globals.css`.
  document.documentElement.setAttribute("data-lift", "");

  /* And every blurred surface goes flat for the length of the trip.
   *
   * The one rough moment in opening a photograph is the frame the browser
   * takes its snapshots in: measured on production at 2560x1440 with a
   * retina ratio, 133ms of work in a single frame and a clean sixty for
   * the rest of the animation, which is what reads as a lurch at the
   * start. With every backdrop filter off it measured 67 to 83. The
   * surfaces that cost it are the lightbox's own buttons, which mount
   * inside the update below — hence the second pass in there, before the
   * new snapshot is taken.
   *
   * Written as inline styles and not as a rule, and that is a bug fixed:
   * `:root[data-lift] .glass { backdrop-filter: none !important }` shipped
   * as an empty rule. The build drops a declaration that sets a property
   * to its own initial value, `!important` and all — read back off the
   * live stylesheet as `:root[data-lift] :where(.glass, ...) { }`. */
  const flattened: HTMLElement[] = [];
  const flatten = () => {
    for (const el of document.querySelectorAll<HTMLElement>(
      ".glass, .glass-surface, .glass-prominent",
    )) {
      if (flattened.includes(el)) continue;
      flattened.push(el);
      el.style.backdropFilter = "none";
      el.style.setProperty("-webkit-backdrop-filter", "none");
    }
  };
  flatten();
  const transition = document.startViewTransition(() => {
    // Synchronous, so the new snapshot is of the updated page.
    flushSync(update);
    if (from) from.style.viewTransitionName = "";
    if (to) to.style.viewTransitionName = NAME;
    if (stage) stage.style.viewTransitionName = to ? STAGE : "";
    // The lightbox's chrome exists as of this line and is about to be
    // photographed with the rest of the new page.
    flatten();
  });
  transition.finished
    .finally(() => {
      document.documentElement.removeAttribute("data-lift");
      for (const el of flattened) {
        el.style.removeProperty("backdrop-filter");
        el.style.removeProperty("-webkit-backdrop-filter");
      }
      if (to) to.style.viewTransitionName = "";
      if (stage) stage.style.viewTransitionName = "";
    })
    // A skipped transition — hidden tab, a second one starting — rejects
    // `finished`; the update still ran, and nothing here needs the promise.
    .catch(() => {});
}

/* The full-size picture, fetched and decoded before the trip starts.
 *
 * The dialog's image asks for `100vw`; the frame in the strip asked for a
 * third of that, so opening one is a new file off the network and a decode
 * of several megapixels — and both used to land in the middle of the
 * animation, which is where the stutter Julian reported came from. The
 * strip's own `srcset` lists every width of the same photograph, so the one
 * the dialog is about to choose can be warmed first.
 *
 * Capped: a slow connection must not hold the press. After the cap the trip
 * starts anyway and the picture arrives when it arrives, which is the old
 * behaviour and no worse.
 */
const CAP_MS = 220;
function warm(from: HTMLElement | null): Promise<void> {
  const set = from instanceof HTMLImageElement ? from.srcset : "";
  if (!set) return Promise.resolve();
  const want = window.innerWidth * (window.devicePixelRatio || 1);
  const widths = set
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .map(([url, w]) => ({ url, w: parseInt(w || "0", 10) }))
    .filter((c) => c.url && c.w > 0)
    .sort((a, b) => a.w - b.w);
  const pick = widths.find((c) => c.w >= want) ?? widths[widths.length - 1];
  if (!pick) return Promise.resolve();
  const img = new window.Image();
  img.src = pick.url;
  return Promise.race([
    img.decode().catch(() => {}),
    new Promise<void>((r) => window.setTimeout(r, CAP_MS)),
  ]).then(() => undefined);
}

export function useLightbox(
  frames: Frame[],
  /** The layout the frames sit in, if it should spread around the one
      that opens. */
  stage?: React.RefObject<HTMLElement | null>,
) {
  const count = frames.length;
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  // Radix returns focus to its own `Dialog.Trigger`, and there isn't one here
  // — the lightbox is opened from whichever of twenty-odd frames was clicked.
  // Without this, closing drops focus on <body> and a keyboard visitor has to
  // tab from the top of the page again to get back to where they were.
  const opener = React.useRef<HTMLElement | null>(null);

  const show = (i: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    const src = frames[i]?.src;
    const from = src ? pictureFor(src) : null;
    // Warm first, travel second: see `warm` above.
    void warm(from).then(() =>
      travel(
        from,
        () => {
          setIndex(i);
          setOpen(true);
        },
        null,
        stage?.current,
      ),
    );
  };

  const onOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    // Back to whichever frame is showing now, which after a few arrow keys
    // is not the one that was pressed.
    const src = frames[index]?.src;
    travel(
      null,
      () => setOpen(false),
      src ? pictureFor(src) : null,
      stage?.current,
    );
    /* After the closing transition, not during it: called here the focus
       landed on an element that was still inside a dialog on its way out,
       and the return put it on the body instead — so a keyboard visitor
       lost their place in the sequence. */
    window.setTimeout(() => opener.current?.focus(), 120);
  };

  const step = React.useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  // Arrow keys page through the sequence. Radix handles Escape and the focus
  // trap; focus restoration is `onOpenChange` above.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  return { open, index, show, onOpenChange, step };
}

/* ── the swipe ────────────────────────────────────────────────────
 * On a phone the frame follows the finger. Sideways pages the sequence,
 * down lets go of it; either commits on a flick regardless of distance,
 * because a flick is a decision and making it travel a third of the screen
 * as well is asking twice. Under that, the picture stays glued to the
 * finger — 1:1, from where it was grabbed — and springs back from wherever
 * it is if the gesture is abandoned.
 *
 * Pointer Events with capture, so a swipe that leaves the picture's box
 * keeps tracking. Mice are left out: with a pointer the arrows, the keys and
 * a click outside are all quicker than a drag, and a mouse-down that pans a
 * photograph is not what anyone expects.
 *
 * The pull past the ends of a one-frame sequence, and upward, rubber-bands
 * rather than stopping — a hard stop reads as frozen, resistance reads as
 * "nothing further this way".
 * ─────────────────────────────────────────────────────────────── */

/** Above this, in px per ms, a release commits whatever it was doing. */
const FLICK = 0.11;
/** Before this many px the gesture has no axis; a tap stays a tap. */
const SLOP = 10;

type Sample = { t: number; x: number; y: number };

function useSwipe({
  onStep,
  onDismiss,
}: {
  onStep: (delta: 1 | -1) => void;
  onDismiss: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    id: number;
    x0: number;
    y0: number;
    axis: "x" | "y" | null;
    samples: Sample[];
  } | null>(null);
  // Set while a gesture moved, so the click that can follow a release does
  // not also close the lightbox.
  const moved = React.useRef(false);

  const place = (x: number, y: number, opacity: number, settle: boolean) => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.style.transition =
      settle && !still
        ? "transform 360ms var(--ease-spring), opacity 200ms var(--ease-out-strong)"
        : "none";
    el.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
    el.style.opacity = opacity === 1 ? "" : String(opacity);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    // Capture keeps the swipe tracking past the picture's edge. It throws
    // when the pointer is already gone, and a swipe without capture still
    // works — it just lets go at the edge.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      axis: null,
      samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
    moved.current = false;
    // Grabbing a picture mid-spring stops it where it is.
    place(0, 0, 1, false);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    d.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (d.samples.length > 6) d.samples.shift();

    if (!d.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      d.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      moved.current = true;
    }
    const el = e.currentTarget;
    if (d.axis === "x") {
      place(dx, 0, 1, false);
    } else {
      // Down is the gesture; up is resisted.
      const y = dy > 0 ? dy : rubberband(dy, el.clientHeight);
      place(0, y, Math.max(0.3, 1 - Math.max(0, dy) / el.clientHeight), false);
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const el = e.currentTarget;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;

    if (d.axis === "x") {
      const commit =
        Math.abs(dx) > el.clientWidth * 0.3 || Math.abs(vx) > FLICK;
      // Sign, not position: a flick back the way it came reverses.
      const dir: 1 | -1 = (Math.abs(vx) > FLICK ? vx : dx) < 0 ? 1 : -1;
      if (commit) {
        onStep(dir);
        // The next frame starts a little in from the side it is coming from
        // and settles — one strip moving, not one picture replaced by another.
        place(dir * -el.clientWidth * 0.2, 0, 0, false);
        requestAnimationFrame(() => place(0, 0, 1, true));
        return;
      }
    } else if (d.axis === "y") {
      const commit = dy > el.clientHeight * 0.25 || vy > FLICK;
      if (commit) {
        // Clean before the trip home, so the snapshot is of the frame and
        // not of the frame half off the screen.
        place(0, 0, 1, false);
        onDismiss();
        return;
      }
    }
    place(0, 0, 1, true);
  };

  const onClickCapture: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (moved.current) {
      e.stopPropagation();
      moved.current = false;
    }
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}

export function Lightbox({
  frames,
  name,
  open,
  index,
  onOpenChange,
  step,
}: {
  frames: Frame[];
  /** What the sequence is, for the dialog's accessible title. */
  name: string;
} & Omit<ReturnType<typeof useLightbox>, "show">) {
  const current = frames[index];
  const { ref: picture, handlers: swipe } = useSwipe({
    onStep: step,
    onDismiss: () => onOpenChange(false),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/95 animate-in fade-in duration-200 ease-out motion-reduce:animate-none" />

        <Dialog.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col outline-none",
            // Modals keep a centred origin — they are not anchored to a
            // trigger, so scaling from one would look arbitrary.
            // A fade only. The scale it used to carry is the frame's own
            // job now: it arrives from where it was pressed.
            "animate-in fade-in duration-200 ease-out motion-reduce:animate-none",
          )}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{`${name}, frame ${index + 1} of ${frames.length}`}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Anywhere that is not the picture closes it — Julian asked. The
              check is against the element itself, so a click on the frame
              stays put and the controls below keep their own jobs. */}
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
            className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10"
          >
            {/* What the finger moves. The wrapper stays mounted across a
                step, so the offset it was released at is where the next
                frame starts from. `touch-none` hands every touch to the
                swipe; the page underneath is a dialog and does not scroll. */}
            <div
              ref={picture}
              data-ring="Zoom out"
              {...swipe}
              onClick={(e) => {
                if (e.target === e.currentTarget) onOpenChange(false);
              }}
              className="flex h-full w-full touch-none select-none items-center justify-center will-change-transform"
            >
              {current ? (
                <Image
                  key={current.src}
                  // The destination on the way in and the origin on the way out —
                  // see `travel`. Only one of these is ever mounted.
                  style={{ viewTransitionName: NAME }}
                  src={current.src}
                  alt={current.alt || `${name}, frame ${index + 1}`}
                  width={current.width}
                  height={current.height}
                  sizes="100vw"
                  priority
                  className="max-h-full w-auto max-w-full object-contain"
                />
              ) : null}
            </div>
          </div>

          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
            className="flex shrink-0 items-center justify-between gap-6 px-6 pb-6 sm:px-10 sm:pb-8"
          >
            <p className="label text-muted-foreground">
              {index + 1} / {frames.length}
            </p>

            <div className="flex items-center gap-2">
              <LightboxButton onClick={() => step(-1)} label="Previous frame">
                &larr;
              </LightboxButton>
              <LightboxButton onClick={() => step(1)} label="Next frame">
                &rarr;
              </LightboxButton>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="label glass ml-4 rounded-full px-4 py-2.5 text-muted-foreground press hoverable:hover:text-foreground active:scale-[0.97]"
                >
                  Close
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LightboxButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // 44px minimum target — this is the control someone taps repeatedly on
      // a phone, so it gets a real hit area rather than an icon's worth.
      className="glass flex h-11 w-11 items-center justify-center rounded-full text-base press active:scale-[0.97]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
