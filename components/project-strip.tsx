"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PointerRing } from "@/components/pointer-ring";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { cn } from "@/lib/utils";
import type { Project, TextBlock, Frame } from "@/lib/work-types";

/* ── the sequence, across the screen ──────────────────────────────
 * A project is one screen and the frames run across it, all at the same
 * height, in the order Julian sequenced them. Julian asked for the project
 * pages to work like remyshoots.co.za: a filmstrip with the title over it
 * and a thin instrument panel under it.
 *
 * Why this suits the work better than the spread it replaces: a sequence is
 * a sequence. Down a page, two frames sit side by side because they happen
 * to be portraits and the next pair is a screen away; across a strip every
 * frame is the same height, the one before and the one after are both in
 * view, and the shape of each photograph is the only thing that varies. It
 * is a contact sheet at a size worth looking at.
 *
 * Native scrolling, not a transform driven by pointer events. It costs
 * nothing to a keyboard (arrow keys and Home/End land for free), a
 * touchscreen swipes it with the platform's own momentum, and a trackpad's
 * horizontal gesture works without being interpreted.
 *
 * Two things are added, both for a mouse. A vertical wheel moves the strip
 * sideways until it runs out, and then the page has it back — the same
 * handover the work index uses, which is the behaviour Julian asked for
 * there. And the strip can be dragged: grab a frame and pull, and let go to
 * send it coasting. See "how it moves" below.
 *
 * The sequence ends on the next project, not on nothing: its cover and its
 * name are the last cell of the strip, and a wheel that keeps turning once
 * the strip and the page have both run out goes there. Julian's reference
 * for the whole page is remyshoots.co.za, where this is how one project
 * leads to the next; see "the way on" below.
 * ─────────────────────────────────────────────────────────────── */

type Cell =
  | { kind: "frame"; frame: Frame; n: number }
  | { kind: "text"; block: TextBlock }
  | { kind: "next" };

export type NextUp = {
  href: string;
  name: string;
  client?: string;
  frame?: Frame;
};

/** How far past the end a wheel has to push before it leads on, in px of
    wheel delta. Three notches on a mouse: an overshoot of one is a
    reader arriving at the end, not asking to leave it. */
const LEAVE_AFTER = 300;

export function ProjectStrip({
  project,
  next,
  className,
}: {
  project: Project;
  /** What the strip ends on and where a wheel past the end goes. */
  next?: NextUp;
  className?: string;
}) {
  const frames = project.images;
  const scroller = React.useRef<HTMLDivElement>(null);
  const lightbox = useLightbox(frames, scroller);
  const [at, setAt] = React.useState(0);
  const router = useRouter();
  // Stable for the life of the strip: the page keys it by project.
  const nextHref = next?.href;

  /* The photographs with the writing back in its place. `lib/work.ts` pulls
     the two apart — the lightbox and the counts have no use for a paragraph
     — and a strip is the one place that wants them interleaved again, each
     block a cell of its own where it was written. */
  const cells = React.useMemo<Cell[]>(() => {
    const byPosition = new Map<number, TextBlock[]>();
    for (const b of project.blocks ?? []) {
      byPosition.set(b.after, [...(byPosition.get(b.after) ?? []), b]);
    }
    const out: Cell[] = [];
    frames.forEach((frame, i) => {
      for (const block of byPosition.get(i) ?? []) out.push({ kind: "text", block });
      out.push({ kind: "frame", frame, n: i });
    });
    for (const block of byPosition.get(frames.length) ?? []) {
      out.push({ kind: "text", block });
    }
    if (next) out.push({ kind: "next" });
    return out;
  }, [frames, project.blocks, next]);

  /* Which cell is nearest the middle of the window. Read off the scroll
     position rather than with an observer, because the counter and the
     ruler want it every frame of a drag and not on a threshold. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let queued = 0;
    const read = () => {
      queued = 0;
      const room = el.scrollWidth - el.clientWidth;
      /* Either end is that end's cell, whatever is nearest the middle.
         At the far end the last frame is often narrower than half a window,
         so the middle of the window sits over the one before it and the
         counter could never reach the last frame at all. */
      if (el.scrollLeft >= room - 2) {
        setAt(el.children.length - 1);
        return;
      }
      if (el.scrollLeft <= 2) {
        setAt(0);
        return;
      }
      const middle = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let nearest = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const cell = child as HTMLElement;
        const gap = Math.abs(cell.offsetLeft + cell.offsetWidth / 2 - middle);
        if (gap < nearest) {
          nearest = gap;
          best = i;
        }
      });
      setAt(best);
    };
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(read);
    };
    read();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      if (queued) cancelAnimationFrame(queued);
    };
  }, [cells.length]);

  /* ── how it moves ───────────────────────────────────────────────
     Every way of moving the strip writes to one target and a single rAF
     loop eases the scroller towards it. A wheel notch is ~100px of jump
     if it is applied straight to `scrollLeft`; eased instead, the same
     notch is a glide, and notches that arrive together blend into one
     movement rather than stacking into a jolt. Julian asked for the
     horizontal scroll to be super smooth and to allow drag to scroll.

     A drag is the exception: while a pointer is down the strip tracks it
     exactly, because anything eased there feels like the picture is
     lagging behind the hand. The easing comes back on release, as
     momentum — the strip carries on at the speed it was let go.

     Reduced motion gets the same controls with the interpolation off. */
  const glide = React.useRef<(to: number) => void>(() => {});

  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const eased = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    const room = () => el.scrollWidth - el.clientWidth;
    const clamp = (v: number) => Math.min(room(), Math.max(0, v));
    let target = el.scrollLeft;
    let frame = 0;
    let from = 0;
    let began = 0;
    let span = 0;

    /* A fixed duration and an ease-out, not a proportional lerp. A lerp
       that closes a sixth of the gap each frame trails a spinning wheel by
       six frames of travel, and each notch ends in a pixel-a-frame crawl,
       which reads as lag. This one starts at full speed from wherever the
       strip is, arrives inside the duration and stops with the velocity at
       zero. A notch that lands mid-glide restarts the ease from the current
       position towards the new target, so notches stack without a jolt and
       the strip is never more than a fraction of one behind the hand. Time
       based, so a 60Hz and a 144Hz display feel the same. */
    const step = (now: number) => {
      const p = Math.min(1, (now - began) / span);
      const eased = 1 - (1 - p) ** 3;
      el.scrollLeft = from + (target - from) * eased;
      frame = p < 1 ? requestAnimationFrame(step) : 0;
    };

    const to = (v: number, ms?: number) => {
      target = clamp(v);
      if (!eased) {
        el.scrollLeft = target;
        return;
      }
      from = el.scrollLeft;
      began = performance.now();
      // A tick's jump goes for longer the further it is, within reason:
      // about half a second to the far end.
      span = ms ?? 200 + Math.min(400, Math.abs(target - from) * 0.16);
      if (!frame) frame = requestAnimationFrame(step);
    };
    glide.current = to;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      target = el.scrollLeft;
    };

    /* A vertical wheel moves the strip sideways, and stops doing so at
       either end so the page can carry on to the enquiry below.
       `passive: false` because it has to be able to take the event; left
       passive, the browser would scroll the page at the same time and both
       would move. The end is read off the target rather than off
       `scrollLeft`, or a notch that arrives while the strip is still
       gliding into the last frame would be handed to the page. */
    /* ── the way on ──
       Past the end, the page gets the wheel and scrolls to its foot. With
       the page at its foot too, the wheel is asking for what comes next,
       and three notches of it go there: the strip slides off to the left
       and the next project's strip arrives from the right (`strip-scroll`
       in `globals.css`). A notch back cancels the count. */
    let over = 0;
    let leaving = false;
    const leave = () => {
      if (!nextHref || leaving) return;
      leaving = true;
      el.dataset.leaving = "";
      window.setTimeout(() => router.push(nextHref), 260);
    };

    const onWheel = (e: WheelEvent) => {
      // A pinch is a zoom, and a trackpad's sideways swipe already works.
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY < 0) over = 0;
      if (e.deltaY > 0 && target >= room() - 1) {
        const foot =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 1;
        if (foot && (over += e.deltaY) >= LEAVE_AFTER) leave();
        return;
      }
      if (e.deltaY > 0 ? target >= room() - 1 : target <= 0) return;
      over = 0;
      e.preventDefault();
      /* Firefox can report lines rather than pixels. A flat 160ms
         whatever the distance: notches that stack while the wheel spins
         then make the strip move faster, not for longer, so it stays
         within about one notch of the hand however fast the wheel turns. */
      to(target + (e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY), 160);
    };

    /* Drag, for a mouse. A touchscreen is left alone: the platform's own
       flick and momentum are better than anything reimplemented here, and
       taking the gesture would break the vertical swipe out of the strip. */
    let down = false;
    let dragging = false;
    let fromX = 0;
    let fromScroll = 0;
    let lastX = 0;
    let lastAt = 0;
    let speed = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      dragging = false;
      stop();
      fromX = lastX = e.clientX;
      fromScroll = el.scrollLeft;
      lastAt = e.timeStamp;
      speed = 0;
      delete el.dataset.dragged;
    };

    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dt = e.timeStamp - lastAt;
      // px per ms, positive when the sequence is being pulled leftwards.
      if (dt > 0) speed = (lastX - e.clientX) / dt;
      lastX = e.clientX;
      lastAt = e.timeStamp;
      target = clamp(fromScroll - (e.clientX - fromX));
      el.scrollLeft = target;

      /* Past a few pixels this is a drag rather than a press, and two
         things change. The frame under the pointer must not open when the
         button comes back up. And the pointer is captured, so a hand that
         leaves the strip mid-pull keeps pulling it.

         Capture only from here, never on the press itself: capturing
         retargets the compatibility mouse events too, so the `click` that
         follows is delivered to the scroller instead of the frame — which
         is exactly how the first version of this stopped the lightbox from
         opening at all. */
      if (!dragging && Math.abs(e.clientX - fromX) > 4) {
        dragging = true;
        el.dataset.dragged = "";
        el.setPointerCapture(e.pointerId);
      }
    };

    const onUp = () => {
      if (!down) return;
      down = false;
      dragging = false;
      // A flick keeps going. The ease-out above leaves at three times the
      // distance over the duration, so 220ms of travel over 660ms sets off
      // at exactly the speed the hand let go and decays from there.
      if (eased && Math.abs(speed) > 0.05) to(target + speed * 220, 660);
      // After the click that this release is about to fire, not before.
      requestAnimationFrame(() => delete el.dataset.dragged);
    };

    const swallowClick = (e: MouseEvent) => {
      if (el.dataset.dragged === undefined) return;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", swallowClick, true);
    // The keyboard and a touchscreen write `scrollLeft` themselves; the
    // target has to follow, or the next wheel notch would spring back.
    const sync = () => {
      if (!down && !frame) target = el.scrollLeft;
    };
    el.addEventListener("scroll", sync, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", swallowClick, true);
      el.removeEventListener("scroll", sync);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [router, nextHref]);

  /** Puts a cell in the middle of the window. */
  const goTo = (i: number) => {
    const el = scroller.current;
    const cell = el?.children[i] as HTMLElement | undefined;
    if (!el || !cell) return;
    glide.current(cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2);
  };

  // The number under the strip counts photographs, so a paragraph between
  // two of them holds the count of the frame it was written after: the last
  // frame at or before the cell in the middle of the window.
  const shown = React.useMemo(() => {
    for (let i = Math.min(at, cells.length - 1); i >= 0; i--) {
      const cell = cells[i];
      if (cell?.kind === "frame") return cell.n + 1;
    }
    return 1;
  }, [at, cells]);

  return (
    <>
      <div className={cn("flex min-h-0 flex-col", className)}>
        <div
          ref={scroller}
          tabIndex={0}
          aria-label={`${project.name}: ${frames.length} frames, left and right`}
          /* No scroll snapping. Every movement here is a scroll the strip
             started itself — a wheel notch, a drag, a flick's momentum, a
             tick — and snap re-aims each one as it settles, which reads as
             the sequence being tugged out of your hand. The momentum stops
             where it is let go instead. */
          className={cn(
            "flex min-h-0 flex-1 select-none items-center gap-3 overflow-x-auto overflow-y-hidden sm:gap-4",
            "px-6 sm:px-10",
            "strip-scroll focus-visible:outline-none",
          )}
        >
          {cells.map((cell) =>
            cell.kind === "next" ? (
              /* The last cell: the next project's cover at the strip's
                 height with its name beside it, the whole thing one link.
                 A portrait frame where the project has one, so it reads
                 as a cover and not as the sequence carrying on. */
              <Link
                key="next"
                href={next!.href}
                data-ring="Next project"
                className="group flex h-full shrink-0 items-center gap-6 pr-6 sm:gap-8 sm:pr-10 hoverable:cursor-none"
              >
                {next!.frame ? (
                  <span
                    className="relative block h-full shrink-0 overflow-hidden"
                    style={{
                      backgroundColor: next!.frame.color,
                      aspectRatio: `${next!.frame.width} / ${next!.frame.height}`,
                    }}
                  >
                    <Image
                      src={next!.frame.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 40vw, 70vw"
                      draggable={false}
                      className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.03]"
                    />
                  </span>
                ) : null}
                <span className="flex flex-col gap-2">
                  <span className="label text-muted-foreground">
                    Next project
                  </span>
                  <span className="font-display text-2xl uppercase leading-none tracking-[0] sm:text-4xl">
                    {next!.name}
                  </span>
                  {next!.client ? (
                    <span className="label text-muted-foreground">
                      {next!.client}
                    </span>
                  ) : null}
                </span>
              </Link>
            ) : cell.kind === "text" ? (
              <div
                key={`text-${cell.block.after}-${cell.block.heading ?? ""}`}
                className="flex h-full w-[min(24rem,80vw)] shrink-0 flex-col justify-center"
              >
                {cell.block.heading ? (
                  <h2 className="font-display text-xl uppercase leading-none tracking-[0]">
                    {cell.block.heading}
                  </h2>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {cell.block.body}
                </p>
              </div>
            ) : (
              /* Full height, and as wide as that height makes it: the
                 photograph's own shape is the only thing that decides how
                 much of the strip it takes. */
              <button
                key={cell.frame.src}
                data-ring="Zoom in"
                type="button"
                onClick={() => lightbox.show(cell.n)}
                aria-label={`Open frame ${cell.n + 1} of ${frames.length}${
                  cell.frame.alt ? `: ${cell.frame.alt}` : ""
                }`}
                className="group relative h-full shrink-0 overflow-hidden press hoverable:cursor-none active:scale-[0.995]"
                style={{
                  backgroundColor: cell.frame.color,
                  aspectRatio: `${cell.frame.width} / ${cell.frame.height}`,
                }}
              >
                <Image
                  // How the lightbox finds the frame to lift out of the
                  // strip, and to land back in. See `lightbox.tsx`.
                  data-frame={cell.frame.src}
                  src={cell.frame.src}
                  alt={cell.frame.alt || `${project.name}, frame ${cell.n + 1}`}
                  fill
                  sizes="(min-width: 1024px) 60vw, 90vw"
                  // The first two are on screen at once on nearly every
                  // window; the rest arrive as the strip reaches them.
                  priority={cell.n < 2}
                  placeholder={
                    cell.n === 0 && project.cover.blur ? "blur" : "empty"
                  }
                  blurDataURL={cell.n === 0 ? project.cover.blur : undefined}
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </button>
            ),
          )}
        </div>

        {/* The panel: a tick for every cell, the one you are on inked and
            tall, and the count beside it. Each tick is a control — the strip
            is long and a visitor who wants the last frame should not have to
            travel the whole sequence to reach it. */}
        <div className="mt-4 flex items-end gap-6 px-6 sm:px-10">
          <p className="label shrink-0 tabular-nums text-muted-foreground">
            <span className="text-foreground">
              {String(shown).padStart(2, "0")}
            </span>
            {" / "}
            {String(frames.length).padStart(2, "0")}
          </p>

          <div
            aria-hidden
            className="flex min-w-0 flex-1 items-end justify-between gap-px"
          >
            {cells.map((cell, i) =>
              cell.kind === "next" ? null : (
              <button
                key={`tick-${i}`}
                type="button"
                tabIndex={-1}
                onClick={() => goTo(i)}
                className="group flex h-4 flex-1 items-end"
              >
                <span
                  className={cn(
                    "block w-full rounded-full transition-[height,background-color] duration-200 ease-[var(--ease-out-strong)]",
                    i === at
                      ? "h-4 bg-foreground"
                      : "h-1.5 bg-foreground/20 hoverable:group-hover:bg-foreground/50",
                  )}
                />
              </button>
              ),
            )}
          </div>
        </div>
      </div>

      <PointerRing />
      <Lightbox frames={frames} name={project.name} {...lightbox} />
    </>
  );
}
