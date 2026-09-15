"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PointerRing } from "@/components/pointer-ring";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { cn, rubberband } from "@/lib/utils";
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
  | { kind: "title" }
  | { kind: "frame"; frame: Frame; n: number }
  | { kind: "text"; block: TextBlock }
  | { kind: "next" };

/** Neither of the two cells that are words rather than photographs: they
    take no number, no tick, and no place in the count. */
const isWords = (c: Cell) => c.kind === "title" || c.kind === "next";

export type NextUp = {
  href: string;
  name: string;
  client?: string;
};

/** How far past the end a wheel has to push before it leads on, in px of
    wheel delta. Three notches on a mouse: an overshoot of one is a
    reader arriving at the end, not asking to leave it. */
const LEAVE_AFTER = 300;
/** How long a push is held after the last notch before it starts to drain,
    so the notches of a steady spin add up rather than leak away between
    them: a notched wheel fires about ten times a second, and a drain that
    ran through the gaps levelled a spin off short of LEAVE_AFTER. Then
    RELAX is the spring: the time in which the held push falls to a third
    once the hand has stopped. Fast, because a band that takes a second to
    come back reads as the page being stuck, not as give. */
const HOLD = 200;
const RELAX = 120;
/** The most the band ever shows, in px. Resistance, not travel. */
const STRETCH = 160;

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
  // The frames' click handler reaches the lightbox through a ref, so the
  // cells below can be built once and not again for every counter change.
  const show = React.useRef(lightbox.show);
  React.useEffect(() => {
    show.current = lightbox.show;
  });

  /* The photographs with the writing back in its place. `lib/work.ts` pulls
     the two apart — the lightbox and the counts have no use for a paragraph
     — and a strip is the one place that wants them interleaved again, each
     block a cell of its own where it was written. */
  const cells = React.useMemo<Cell[]>(() => {
    const byPosition = new Map<number, TextBlock[]>();
    for (const b of project.blocks ?? []) {
      byPosition.set(b.after, [...(byPosition.get(b.after) ?? []), b]);
    }
    /* The sequence opens on the title. Julian asked for the title in large
       bold with the credits right before the first image, which is also
       where a printed portfolio puts them: the plate before the plates. */
    const out: Cell[] = [{ kind: "title" }];
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
      /* Whether the opening plate has gone. The page header carries the same
         name in small capitals and it waits for this: two titles on one
         screen is the same words twice. Half the card's width, so the swap
         happens as it leaves rather than after it has. The rule that reads
         this is in `globals.css`. */
      const card = el.firstElementChild as HTMLElement | null;
      el.toggleAttribute(
        "data-past-title",
        !!card && el.scrollLeft > card.offsetLeft + card.offsetWidth * 0.5,
      );
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
    // Where the strip is and how fast it is going, in px and px per ms.
    let x = el.scrollLeft;
    let v = 0;
    let last = 0;
    /* ── the band ──
       Push past either end and the strip does not stop dead, it gives a
       little and comes back — the resistance Julian asked for at the ends.
       `over` is the raw pull past the end, positive at the right and
       negative at the left; the band shown is that pull through
       `rubberband`, so the first pixels move it and the later ones barely
       do. It drains under RELAX whenever the pushing stops. And at the
       right-hand end it is also the count: keep pushing past LEAVE_AFTER of
       it and the sequence leads on to the next project. So the stretch is
       the receipt for the count — you can see how far along you are. */
    let over = 0;
    let pushed = 0;
    let band = 0;
    let leaving = false;

    /* Drawn with the `translate` property and not `transform`. This is the
       one trap in here: `strip-scroll` in `globals.css` animates
       `transform` for both the arrival and the `[data-leaving]` exit, and an
       inline transform would outrank the exit — the strip would snap back
       to zero and leave from there. The two properties compose instead, so
       the exit slide simply starts from wherever the band had got to. */
    const paint = () => {
      if (leaving) return;
      // Three notches read 48, 94 and 136px, so the band is still growing
      // at the moment it goes. It was half that and Julian said it did not
      // feel like a rubber band: give that cannot be seen is a stop.
      const pull = eased && over ? rubberband(over, el.clientWidth, 0.5) : 0;
      el.style.translate = pull
        ? `${-Math.max(-STRETCH, Math.min(STRETCH, pull))}px`
        : "";
    };

    /* Momentum and friction, measured off the reference. Julian recorded
       remyshoots.co.za; read frame by frame, its strip's speed climbs while
       the wheel turns and then decays once it stops, running out over about
       two thirds of a second. That is velocity with friction: nothing
       chases a target, the strip simply has a speed. A spin is one
       continuous motion because the speed accumulates; a lone notch is a
       glide that tails off. Two earlier tries each felt wrong in their own
       way — a lerp trailed the hand by six frames, and an ease that
       restarted on every notch pulsed at the notch cadence.

       TAU is the friction: the time in which the speed falls to a third,
       and so also how far a speed carries (speed × TAU). It was swept
       against a steady spin rather than picked, because it trades two
       things off. The reference's own tail decays by a fifth per frame,
       which is a TAU near 90 — but a notched wheel fires about ten times a
       second, and at 90 the speed sagged between notches: the strip moved
       between 8px and 27px a frame at exactly the notch cadence. That
       ripple, once per picture, is the snap Julian saw. More friction
       holds the speed through the gaps. Measured on the dev server:

         TAU     90   120   150   180   220
         swing  ±5.4  ±4.0  ±3.3  ±2.8  ±2.5   px per frame
         lag       0     1     4     8    19   px behind after a spin

       180 is where the ripple has flattened and the strip is still within
       8px of the hand. Integrated exactly per frame, so a tick lands where
       it aimed and 60Hz and 144Hz feel the same. `target` is always where
       the strip will stop. */
    const TAU = 180;

    const step = (now: number) => {
      const dt = Math.min(32, last ? now - last : 16);
      last = now;
      const decay = Math.exp(-dt / TAU);
      x += v * TAU * (1 - decay);
      v *= decay;
      const end = room();
      if (x <= 0 || x >= end) {
        x = Math.min(end, Math.max(0, x));
        v = 0;
      }
      if (Math.abs(target - x) < 0.5 && Math.abs(v) * TAU < 0.5) {
        x = target;
        v = 0;
        el.scrollLeft = x;
        frame = 0;
        last = 0;
        return;
      }
      el.scrollLeft = x;
      frame = requestAnimationFrame(step);
    };

    /** The band's own loop, apart from the strip's: it holds while the
        pushing goes on and drains once it stops. Its own loop because the
        strip's writes `scrollLeft` every frame, and a strip loop kept up for
        the band would overwrite a keyboard or touch scroll for as long as
        the band took to settle — seen in the test, where a jump to the end
        was put straight back to the start. */
    /** Lets the band go: CSS springs it back (`[data-release]` in
        `globals.css`), so nothing here paints the return frame by frame. */
    const release = () => {
      if (leaving || "release" in el.dataset) return;
      el.dataset.release = "";
      el.style.translate = "";
    };
    const relax = (now: number) => {
      if (now - pushed > HOLD) {
        release();
        // The count drains on its own clock, unseen.
        over *= Math.exp(-16 / RELAX);
        if (Math.abs(over) < 1) over = 0;
      }
      band = over ? requestAnimationFrame(relax) : 0;
    };
    const push = (by: number) => {
      over += by;
      pushed = performance.now();
      delete el.dataset.release;
      paint();
      if (!band) band = requestAnimationFrame(relax);
    };

    /** Aims the strip: sets the speed that runs out exactly at `where`. */
    const to = (where: number) => {
      target = clamp(where);
      if (!eased) {
        el.scrollLeft = target;
        return;
      }
      // Pick up from wherever the keyboard, a touch or a drag left it.
      if (!frame) {
        x = el.scrollLeft;
        last = 0;
      }
      v = (target - x) / TAU;
      if (!frame) frame = requestAnimationFrame(step);
    };
    glide.current = to;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      v = 0;
      x = target = el.scrollLeft;
    };

    /* A vertical wheel moves the strip sideways, and stops doing so at
       either end so the page can carry on to the enquiry below.
       `passive: false` because it has to be able to take the event; left
       passive, the browser would scroll the page at the same time and both
       would move. The end is read off the target rather than off
       `scrollLeft`, or a notch that arrives while the strip is still
       gliding into the last frame would be handed to the page. */
    /* ── the way on ──
       Push past the right-hand end and the band shows it; keep pushing and
       the sequence leads on: the strip slides off to the left and the next
       project's strip arrives from the right (`strip-scroll` in
       `globals.css`). Stop pushing and the band relaxes and the count with
       it, so a wheel that merely arrives at the end and overshoots goes
       nowhere, and only one that persists does. Julian asked for exactly
       that: a little resistance, and if the scrolling persists, the next
       project.

       Arriving does not count as asking to leave again. The strip a visitor
       has just been carried to mounts with the wheel still turning, and
       without this one hard spin skipped a project and then the one after
       it. Half a second of quiet makes each step a decision. */
    const arrived = performance.now();
    const leave = () => {
      if (!nextHref || leaving || performance.now() - arrived < 500) return;
      leaving = true;
      // The band holds where it is and the slide starts from it.
      if (band) cancelAnimationFrame(band);
      band = 0;
      el.dataset.leaving = "";
      window.setTimeout(() => router.push(nextHref), 260);
    };

    const onWheel = (e: WheelEvent) => {
      // A pinch is a zoom, and a trackpad's sideways swipe already works.
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // Firefox can report lines rather than pixels.
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;

      /* By where the strip is, not where it is heading: a notch that lands
         while the strip is still gliding up to the end aims it there and
         no further, and only once it has got there does the next one pull
         the band. That tail of the glide is the beat between arriving and
         asking to leave, and it comes free with the friction. */
      if (dy > 0 ? el.scrollLeft >= room() - 1 : el.scrollLeft <= 0) {
        /* Under 40rem the page still has a footer below it, and that goes
           first, in both directions. From 40rem up the page cannot scroll
           at all (`globals.css`), so neither of these is ever true there. */
        if (dy < 0 && window.scrollY > 0) return;
        if (
          dy > 0 &&
          document.documentElement.scrollHeight -
            window.innerHeight -
            window.scrollY >
            1
        ) {
          return;
        }
        e.preventDefault();
        push(dy);
        // Only ever at the right-hand end: a negative count cannot reach
        // it. The left end resists and springs back, and that is all — the
        // strip starts there, and a visitor who has just opened a project
        // should not be thrown out of it backwards.
        if (over >= LEAVE_AFTER) leave();
        return;
      }
      e.preventDefault();
      // A notch the other way lets go of the band, and of the count.
      if (over) {
        over = 0;
        release();
      }
      to(target + dy);
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
      const want = fromScroll - (e.clientX - fromX);
      target = clamp(want);
      el.scrollLeft = target;
      // Whatever the clamp refused is the band: pull past an end and it
      // gives, and holds where the hand holds it while the loop is stopped.
      push(want - target - over);

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
      // A flick keeps going: let go at a speed, the strip carries on at
      // that speed and runs out under the same friction as a notch. A drag
      // past the end springs back and never leads on: a grab that threw
      // you into another project would be a surprise, and the wheel is the
      // gesture that travels.
      if (eased && Math.abs(speed) > 0.05) to(el.scrollLeft + speed * TAU);
      // After the click that this release is about to fire, not before.
      requestAnimationFrame(() => delete el.dataset.dragged);
    };

    const swallowClick = (e: MouseEvent) => {
      if (el.dataset.dragged === undefined) return;
      e.preventDefault();
      e.stopPropagation();
    };

    // A press on a frame opens it. Delegated, so the cells can be built
    // once (see `cellNodes`) and the lightbox reached through a ref.
    const openFrame = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-n]",
      );
      if (b && el.contains(b)) show.current(Number(b.dataset.n));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", swallowClick, true);
    el.addEventListener("click", openFrame);
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
      el.removeEventListener("click", openFrame);
      el.removeEventListener("scroll", sync);
      if (frame) cancelAnimationFrame(frame);
      if (band) cancelAnimationFrame(band);
      el.style.translate = "";
      delete el.dataset.release;
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

  /* Built once per project, not once per scroll. The counter and the ticks
     change cell many times across a drag, and each change is a render of
     this component; handed the same elements again React skips the seven
     photographs and re-renders only the panel. A re-render of the whole
     strip at each cell boundary is a frame dropped exactly where the eye is
     moving from one picture to the next. */
  const cellNodes = React.useMemo(
    () =>
      cells.map((cell) =>
        cell.kind === "title" ? (
              /* The opening plate: the name of the work, large, with whoever
                 made it under it. These used to be a row of small capitals
                 under the sequence; they open it instead, which is what
                 Julian asked for and which hands the page back most of the
                 height that showing the footer costs.

                 Four of the seventy-three projects carry credits, so this is
                 usually a title alone. That is the point of putting it
                 somewhere worth filling in: they are added in /admin. */
              <div
                key="title"
                className="flex h-full w-[min(30rem,82vw)] shrink-0 flex-col justify-center gap-5 pr-2 sm:pr-6"
              >
                <h2 className="font-display text-4xl uppercase leading-[0.95] tracking-[0] sm:text-6xl">
                  {project.headline ?? project.name}
                </h2>

                {/* The writing about the work, when there is any. It used to
                    sit in the page header, where on a page that cannot
                    scroll a paragraph would have squeezed the photographs.
                    Skipped when it is the title again, or a leftover credit
                    line ("styling: @handle") which the credits below say
                    properly. Either can be rewritten in /admin. */}
                {project.intent &&
                !project.intent.includes("@") &&
                project.intent.trim().toLowerCase() !==
                  project.name.trim().toLowerCase() ? (
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {project.intent}
                  </p>
                ) : null}

                {project.credits.length ? (
                  <dl
                    aria-label="Credits"
                    className="flex flex-col gap-1 border-t border-border pt-4"
                  >
                    {project.credits.map((credit, i) => {
                      /* Six harvested credits carry the handle as the name
                         ("@apricotsss3") with no instagram field; they link
                         too. */
                      const handle =
                        credit.instagram ??
                        (credit.name.startsWith("@")
                          ? credit.name.slice(1)
                          : null);
                      return (
                        <div
                          key={`${credit.role}-${i}`}
                          className="flex items-baseline gap-3"
                        >
                          <dt className="label w-28 shrink-0 text-muted-foreground/70">
                            {credit.role}
                          </dt>
                          <dd className="label min-w-0">
                            {handle ? (
                              /* A new tab on purpose: the visitor is on a
                                 project, and taking the page out from under
                                 them to show someone else's feed would lose
                                 their place. */
                              <a
                                href={`https://www.instagram.com/${handle}/`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                              >
                                {credit.name}
                                <span className="sr-only">
                                  {" "}
                                  on Instagram (opens in a new tab)
                                </span>
                              </a>
                            ) : (
                              credit.name
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : null}
              </div>
        ) : cell.kind === "next" ? (
              /* The last cell: where the sequence goes next, written and
                 not shown. It carried the next project's cover for a day
                 and Julian said the image from the next page was showing
                 up on this one — which is also how the reference has it:
                 the sequence ends, and past the last photograph there is
                 the name of what follows on empty ground. The pictures on
                 a project page are that project's. */
              <Link
                key="next"
                href={next!.href}
                data-ring="Next project"
                className="flex h-full shrink-0 flex-col justify-center gap-2 pl-10 pr-6 sm:pl-24 sm:pr-10 hoverable:cursor-none"
              >
                <span className="label text-muted-foreground">
                  Next project
                </span>
                <span className="font-display text-2xl uppercase leading-none tracking-[0] transition-opacity duration-200 hoverable:hover:opacity-70 sm:text-4xl">
                  {next!.name}
                </span>
                {next!.client ? (
                  <span className="label text-muted-foreground">
                    {next!.client}
                  </span>
                ) : null}
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
                // Opened by the delegated listener in the movement effect,
                // which is where a ref may be read.
                data-n={cell.n}
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
                  // The first two lead the page's loading; every other frame
                  // is fetched at once rather than as the strip reaches it.
                  // Left lazy, Julian's recording showed each frame arriving
                  // as a block of colour and filling in under the wheel,
                  // and the swap from block to picture read as a snap
                  // between every image. The page is the sequence; the
                  // sequence has to be there.
                  priority={cell.n < 2}
                  loading="eager"
                  placeholder={
                    cell.n === 0 && project.cover.blur ? "blur" : "empty"
                  }
                  blurDataURL={cell.n === 0 ? project.cover.blur : undefined}
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </button>
            ),
      ),
    [
      cells,
      frames.length,
      project.name,
      project.headline,
      project.intent,
      project.credits,
      project.cover.blur,
      next,
    ],
  );

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
          {cellNodes}
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
              isWords(cell) ? null : (
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
