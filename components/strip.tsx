"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn, rubberband } from "@/lib/utils";

/* ── the strip ────────────────────────────────────────────────────
 * One screen, and the page runs across it. This is the machine behind
 * every horizontal page on the site: the wheel moves the sequence
 * sideways under friction, a mouse can drag it, the ends give like a
 * rubber band, a wheel that keeps pushing past the end leads on to the
 * next page, and the pictures lean with the speed. It began as the
 * project page's filmstrip (`project-strip.tsx`) and was lifted out
 * unchanged when Julian asked for the horizontal look across the whole
 * site: one machine, many sequences, so they all move the same.
 *
 * Native scrolling, not a transform driven by pointer events. It costs
 * nothing to a keyboard, a touchscreen swipes it with the platform's own
 * momentum, and a trackpad's horizontal gesture works without being
 * interpreted. See "how it moves" below for the two things added for a
 * mouse.
 *
 * ── the cell contract ──
 * Every direct child is a cell, a plain element (no fragments: the ruler
 * counts children by index and the DOM has to agree). On the cell:
 *   `data-tick`          a tick on the ruler under the strip
 *   `data-label="Reel"`  the word for the running head and the tick
 *   `data-hash="reel"`   a deep-link target: /page#reel opens on this cell
 *   `.strip-cell` + `--i` the staggered arrival (`globals.css`)
 * Inside a cell:
 *   `data-n={i}` on a button   the delegated `onOpen(i)` (a lightbox)
 *   `.strip-frame` on an image the parallax slide
 *   `data-ring="Open"`         the word under the pointer ring
 *   `[data-scroll]` box        the wheel scrolls it first, then the strip
 * ─────────────────────────────────────────────────────────────── */

/** A page either side of this one: where the wheel goes past an end. */
export type Lead = {
  href: string;
  name: string;
  client?: string;
};

/** Set by a strip on its way out backwards and read by the next one on its
    way in, so the previous sequence arrives from the left and opens at its
    end, which is the side the visitor came in by. Module state rather than
    storage: it only has to survive one client navigation. */
let cameBack = false;

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
/** How far a wheel event carries the strip, as a multiple of its delta.
    Two gains, because a mouse and a trackpad are not the same instrument:
    a mouse notch is a hundred px of delta in one event, a trackpad's swipe
    is dozens of small ones. A sequence is four to nine thousand px wide,
    and at one to one a mouse took forty notches to cross it; at 1.8 Julian
    still said the pages took too long to scroll through on a mouse. So a
    notch carries three times its delta and a trackpad's events under it
    keep the gentler gain. The band's count stays in raw delta, so neither
    makes leaving any easier. */
const WHEEL = 3;
const PAD = 1.8;

/** Where a strip stops being a strip. Under this the cells of a stacking
    page run down the screen and the machine is off; the value is the
    `sm` breakpoint, the same one `globals.css` unlocks the page at. */
const WIDE = "(min-width: 40rem)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const useWide = () =>
  React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    // The server draws the wide page; a phone corrects itself on hydration.
    () => true,
  );

/** The scroll position that puts cell `i` in the middle of the window. */
const centreOf = (el: HTMLElement, i: number) => {
  const cell = el.children[i] as HTMLElement | undefined;
  if (!cell) return null;
  return cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2;
};

export function Strip({
  children,
  label,
  next,
  prev,
  onOpen,
  counter,
  stack = true,
  paged = false,
  bleed = false,
  arrive,
  ref,
  className,
}: {
  children: React.ReactNode;
  /** What the scroller says to a screen reader. */
  label: string;
  /** Where a wheel pushed past the end goes. */
  next?: Lead;
  /** Where a wheel pushed past the start goes. Project chains only: a
      visitor at the top of a page should not be thrown off it backwards. */
  prev?: Lead;
  /** A press on a `[data-n]` button inside a cell, by its number. */
  onOpen?: (n: number) => void;
  /** Drawn left of the ruler, given the index of the cell in the middle. */
  counter?: (at: number) => React.ReactNode;
  /** Under 40rem, run the cells down the page instead and switch the
      machine off. Off for the project strips, which swipe on a phone. */
  stack?: boolean;
  /** One screen at a time. A notch, a swipe or a flick moves to the next
      cell and stops there, instead of the sequence running free under the
      hand. For pages whose cells are whole screens rather than pictures:
      the movement means "the next thing", not "a bit further along". */
  paged?: boolean;
  /** No gutter and no gap, so a cell that is `w-full` is exactly the
      window. Goes with `paged`. */
  bleed?: boolean;
  /** No arrival slide. The homepage's cover must not move in. */
  arrive?: "none";
  /** The scroller, for a lightbox that lifts frames out of it. */
  ref?: React.Ref<HTMLDivElement | null>;
  className?: string;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => scroller.current!, []);
  const [at, setAt] = React.useState(0);
  const [ticks, setTicks] = React.useState<{ i: number; word?: string }[]>([]);
  const tickKey = React.useRef("");
  // For the keyboard, which lives in an effect and must not go stale.
  const atRef = React.useRef(0);
  const wide = useWide();
  const live = stack ? wide : true;
  const router = useRouter();
  // Stable for the life of the strip: pages key it by what it shows.
  const nextHref = next?.href;
  const prevHref = prev?.href;
  const open = React.useRef(onOpen);
  React.useEffect(() => {
    open.current = onOpen;
  });
  const count = React.Children.count(children);

  /* Before the first paint: a deep link opens on its cell, and arriving
     backwards opens at the end with the slide coming from the left. Both
     before paint so the arrival animation is created with the right
     direction and there is never a frame of the strip somewhere else. */
  React.useLayoutEffect(() => {
    const back = cameBack;
    cameBack = false;
    const el = scroller.current;
    if (!el || !live) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      const i = Array.from(el.children).findIndex(
        (c) => (c as HTMLElement).dataset.hash === hash,
      );
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) {
        el.scrollLeft = where;
        return;
      }
    }
    if (back) {
      el.dataset.arrive = "back";
      el.scrollLeft = el.scrollWidth;
    } else if (arrive === "none") {
      el.dataset.arrive = "none";
    }
  }, [live, arrive]);

  /* Which cell is nearest the middle of the window. Read off the scroll
     position rather than with an observer, because the counter and the
     ruler want it every frame of a drag and not on a threshold. */
  const glide = React.useRef<(to: number) => void>(() => {});
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live) return;
    let queued = 0;
    /* The cell in the middle, and its word. The word goes two places by
       hand rather than through state: onto the scroller as `data-at`, and
       into whatever `[data-strip-at]` the page put in its head, so the
       running head can say where you are without a render. */
    const land = (i: number) => {
      atRef.current = i;
      setAt(i);
      /* The word is the nearest labelled cell at or before this one: the
         covers under a discipline carry no word of their own, and the head
         should go on saying the discipline while they go by. */
      let word = "";
      for (let k = i; k >= 0; k--) {
        const w = (el.children[k] as HTMLElement).dataset.label;
        if (w !== undefined) {
          word = w;
          break;
        }
      }
      if (word === el.dataset.at) return;
      el.dataset.at = word;
      const out = el.closest("article")?.querySelector("[data-strip-at]");
      if (out) out.textContent = word;
    };
    const read = () => {
      queued = 0;
      const room = el.scrollWidth - el.clientWidth;
      /* Whether the opening cell has gone. A page's running head waits for
         this: the sequence opens on its title set large, and two titles on
         one screen is the same words twice. Half the cell's width, so the
         swap happens as it leaves rather than after it has. The rule that
         reads this is in `globals.css`. */
      const first = el.firstElementChild as HTMLElement | null;
      el.toggleAttribute(
        "data-past-first",
        !!first && el.scrollLeft > first.offsetLeft + first.offsetWidth * 0.5,
      );
      /* Either end is that end's cell, whatever is nearest the middle.
         At the far end the last cell is often narrower than half a window,
         so the middle of the window sits over the one before it and the
         counter could never reach the last cell at all. */
      const middle = el.scrollLeft + el.clientWidth / 2;
      const kids = Array.from(el.children) as HTMLElement[];
      // Every read before any write, or each write would cost a layout.
      const offs = kids.map((c) => c.offsetLeft + c.offsetWidth / 2 - middle);
      let best = 0;
      let nearest = Infinity;
      offs.forEach((off, i) => {
        if (Math.abs(off) < nearest) {
          nearest = Math.abs(off);
          best = i;
        }
        /* ── the parallax ──
           Where each cell is against the middle of the window, as a
           fraction of the window, handed to it as a custom property. The
           picture inside slides against its frame by a few percent of
           that (`strip-frame` in `globals.css`), so as the frames cross
           the screen the pictures cross it a touch slower and sit behind
           them. Tied to the scroll position and nothing else, so it is as
           smooth as the scroll is and stops when it stops. Julian asked
           for a parallax that is smooth and clean. Cells more than a
           window and a half away are left alone. */
        const par = off / el.clientWidth;
        if (Math.abs(par) > 1.5) {
          if (kids[i].style.getPropertyValue("--par")) {
            kids[i].style.removeProperty("--par");
          }
        } else {
          kids[i].style.setProperty(
            "--par",
            Math.max(-1, Math.min(1, par)).toFixed(3),
          );
        }
      });
      if (el.scrollLeft >= room - 2) land(kids.length - 1);
      else if (el.scrollLeft <= 2) land(0);
      else land(best);
    };
    /* The ruler's ticks, read off the cells once they are in the DOM: a
       cell is often a component of its own, so its attributes are not on
       the element the strip is handed. Set only when they change. */
    const readTicks = () => {
      const t = (Array.from(el.children) as HTMLElement[]).flatMap((c, i) =>
        c.dataset.tick !== undefined ? [{ i, word: c.dataset.label }] : [],
      );
      const key = t.map((x) => `${x.i}:${x.word ?? ""}`).join("|");
      if (key === tickKey.current) return;
      tickKey.current = key;
      setTicks(t);
    };
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(read);
    };
    // A hash changed underfoot (a chip on /work is a plain anchor): glide.
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const i = Array.from(el.children).findIndex(
        (c) => (c as HTMLElement).dataset.hash === hash,
      );
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) glide.current(where);
    };
    // A frame later rather than now, so the first render is not followed
    // by a second one in the same tick.
    queued = requestAnimationFrame(() => {
      readTicks();
      read();
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    window.addEventListener("hashchange", onHash);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      window.removeEventListener("hashchange", onHash);
      if (queued) cancelAnimationFrame(queued);
    };
  }, [live, count]);

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
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live) return;
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
       it and the sequence leads on to the next page. So the stretch is
       the receipt for the count — you can see how far along you are. */
    let over = 0;
    /** While a paged move is landing, another gesture is the same gesture. */
    let locked = 0;
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
    /* How long a paged move owns the wheel. A mouse notch is one turn of
       the hand and another turn a moment later means another screen, so
       its lock is short. A trackpad sends a stream of small deltas for one
       swipe and keeps sending them through the momentum afterwards, so
       every one of those extends the lock: one swipe is one screen, however
       long the fingers keep gliding. */
    const NOTCH_LOCK = 260;
    const SWIPE_LOCK = 380;

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

    /* ── the way on ──
       Push past the right-hand end and the band shows it; keep pushing and
       the sequence leads on: the strip slides off to the left and the next
       page's strip arrives from the right (`strip-scroll` in
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
    const leave = (dir: 1 | -1) => {
      const href = dir > 0 ? nextHref : prevHref;
      if (!href || leaving || performance.now() - arrived < 500) return;
      leaving = true;
      // The band holds where it is and the slide starts from it.
      if (band) cancelAnimationFrame(band);
      band = 0;
      el.dataset.leaving = dir > 0 ? "on" : "back";
      cameBack = dir < 0;
      window.setTimeout(() => router.push(href), 260);
    };

    /* A vertical wheel moves the strip sideways. `passive: false` because
       it has to be able to take the event; left passive, the browser would
       scroll the page at the same time and both would move. */
    const onWheel = (e: WheelEvent) => {
      // A pinch is a zoom, and a trackpad's sideways swipe already works.
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      /* Something inside a cell that scrolls on its own gets the wheel
         first: a form's box until it has run out, a textarea and a select
         always. A strip that took the wheel over a form would move the
         page out from under the words being typed. */
      const inner = (e.target as Element | null)?.closest?.<HTMLElement>(
        "textarea, select, [data-scroll]",
      );
      if (inner && el.contains(inner)) {
        // A textarea or a select keeps the wheel whatever it holds. A
        // marked box gives it back once it has run out, whatever element
        // it happens to be: the contact page's details are a `dl` and the
        // studio's services a `ul`, and a tag-name test left both of them
        // holding the wheel for good.
        if (!inner.hasAttribute("data-scroll")) return;
        const more =
          e.deltaY < 0
            ? inner.scrollTop > 0
            : inner.scrollTop + inner.clientHeight < inner.scrollHeight - 1;
        if (more) return;
      }
      // Firefox can report lines rather than pixels.
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;

      /* By where the strip is, not where it is heading: a notch that lands
         while the strip is still gliding up to the end aims it there and
         no further, and only once it has got there does the next one pull
         the band. That tail of the glide is the beat between arriving and
         asking to leave, and it comes free with the friction. */
      if (dy > 0 ? el.scrollLeft >= room() - 1 : el.scrollLeft <= 0) {
        /* A page that can still scroll vertically goes first, in both
           directions: a project strip on a phone has its footer below it.
           From 40rem up a strip page cannot scroll at all (`globals.css`),
           so neither of these is ever true there. */
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
        // Past the end, on; past the start, back. Julian asked for both.
        if (over >= LEAVE_AFTER) leave(1);
        if (over <= -LEAVE_AFTER) leave(-1);
        return;
      }
      e.preventDefault();
      // A notch the other way lets go of the band, and of the count.
      if (over) {
        over = 0;
        release();
      }
      /* Paged: the gesture means the next screen, whatever its size. A
         trackpad sends a stream of small deltas for one swipe and a mouse
         one large notch for one turn, so the move is locked for as long as
         it takes to land — otherwise a single swipe would fly through four
         sections. */
      if (paged) {
        const now = performance.now();
        const notch = Math.abs(dy) >= 80;
        if (now < locked) {
          if (!notch) locked = now + SWIPE_LOCK;
          return;
        }
        locked = now + (notch ? NOTCH_LOCK : SWIPE_LOCK);
        const last = el.children.length - 1;
        const where = centreOf(
          el,
          Math.max(0, Math.min(last, nearest(target) + (dy > 0 ? 1 : -1))),
        );
        if (where !== null) to(where);
        return;
      }
      to(target + dy * (Math.abs(dy) >= 80 ? WHEEL : PAD));
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
      // A field is for typing and selecting in, not for pulling the page.
      if (
        (e.target as Element | null)?.closest?.(
          "input, textarea, select, label, [data-scroll]",
        )
      ) {
        return;
      }
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
      // you into another page would be a surprise, and the wheel is the
      // gesture that travels.
      if (eased && Math.abs(speed) > 0.05) to(el.scrollLeft + speed * TAU);
      // Paged, a release lands on a screen rather than wherever the throw
      // ran out: the page is the unit, so it is what the hand is holding.
      if (eased && paged) {
        const where = centreOf(el, nearest(target));
        if (where !== null) to(where);
      }
      // After the click that this release is about to fire, not before.
      requestAnimationFrame(() => delete el.dataset.dragged);
    };

    const swallowClick = (e: MouseEvent) => {
      if (el.dataset.dragged === undefined) return;
      e.preventDefault();
      e.stopPropagation();
    };

    // A press on a numbered button opens it. Delegated, so a page can build
    // its cells once and the opener is reached through a ref.
    const openCell = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-n]",
      );
      if (b && el.contains(b)) open.current?.(Number(b.dataset.n));
    };

    /** The cell whose centre is nearest a scroll position. */
    const nearest = (where: number) => {
      const middle = where + el.clientWidth / 2;
      let best = 0;
      let near = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const cell = c as HTMLElement;
        const off = Math.abs(cell.offsetLeft + cell.offsetWidth / 2 - middle);
        if (off < near) {
          near = off;
          best = i;
        }
      });
      return best;
    };

    /* The keyboard, on the scroller itself and nowhere inside it: arrows
       step a cell, Home and End go to the ends. A key pressed in a field
       within a cell is that field's. */
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el) return;
      const last = el.children.length - 1;
      /* Where the strip is going, not where it is: three quick presses
         should step three cells, and each one read the cell in the middle
         of the window while the glide from the press before it was still
         on its way there. */
      const at = nearest(target);
      const i =
        e.key === "ArrowRight"
          ? Math.min(last, at + 1)
          : e.key === "ArrowLeft"
            ? Math.max(0, at - 1)
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? last
                : null;
      if (i === null) return;
      e.preventDefault();
      // The ends themselves for Home and End: the last cell is often
      // narrower than half a window, so its centre is short of the end.
      const where = i === 0 ? 0 : i === last ? room() : centreOf(el, i);
      if (where !== null) to(where);
    };

    /* A scroll the strip did not start — a sideways trackpad swipe, a
       touch drag, a scrollbar — settles on a section rather than wherever
       it ran out. The wheel and the drag are paged by hand above; this is
       every other way the box can be moved, and without it a page could
       sit with two sections half on screen and nothing to pull it
       straight. It waits for the movement to stop, so it never fights the
       gesture, and it does nothing while the strip is driving itself. */
    let settle = 0;
    const onSettle = () => {
      if (!paged || !eased) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (down || dragging || frame || leaving) return;
        const where = centreOf(el, nearest(el.scrollLeft));
        if (where !== null && Math.abs(where - el.scrollLeft) > 2) to(where);
      }, 160);
    };

    /* Tab into a section that is off screen and the browser jumps the box
       to it: instantly, and to wherever it takes to get the element in
       view, which on a paged page is usually between two sections. So the
       jump is put back and the strip travels there itself. Only for the
       keyboard — a press focuses what it presses, and recentring under a
       click would be the page moving for no reason. */
    let beforeTab = -1;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      beforeTab = el.scrollLeft;
      window.setTimeout(() => {
        beforeTab = -1;
      }, 0);
    };
    const onFocusIn = (e: FocusEvent) => {
      const node = e.target as Node | null;
      if (beforeTab < 0 || !node || node === el || !el.contains(node)) return;
      const i = Array.from(el.children).findIndex((c) => c.contains(node));
      const where = i < 0 ? null : centreOf(el, i);
      if (where === null) return;
      el.scrollLeft = beforeTab;
      beforeTab = -1;
      if (Math.abs(where - el.scrollLeft) > 2) to(where);
    };

    el.addEventListener("scroll", onSettle, { passive: true });
    el.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onTab, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", swallowClick, true);
    el.addEventListener("click", openCell);
    el.addEventListener("keydown", onKey);
    // A touchscreen writes `scrollLeft` itself; the target has to follow,
    // or the next wheel notch would spring back.
    const sync = () => {
      if (!down && !frame) target = el.scrollLeft;
    };
    el.addEventListener("scroll", sync, { passive: true });

    return () => {
      window.clearTimeout(settle);
      el.removeEventListener("scroll", onSettle);
      el.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onTab, true);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", swallowClick, true);
      el.removeEventListener("click", openCell);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("scroll", sync);
      if (frame) cancelAnimationFrame(frame);
      if (band) cancelAnimationFrame(band);
      el.style.translate = "";
      delete el.dataset.release;
    };
  }, [router, nextHref, prevHref, live, paged]);

  /** Puts a cell in the middle of the window. */
  const goTo = (i: number) => {
    const el = scroller.current;
    const where = el ? centreOf(el, i) : null;
    if (where !== null) glide.current(where);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label={label}
        /* No scroll snapping. Every movement here is a scroll the strip
           started itself — a wheel notch, a drag, a flick's momentum, a
           tick — and snap re-aims each one as it settles, which reads as
           the sequence being tugged out of your hand. The momentum stops
           where it is let go instead. */
        className={cn(
          "flex min-h-0 flex-1 select-none items-center overflow-x-auto overflow-y-hidden",
          bleed ? "gap-0" : "gap-3 px-6 sm:px-10 sm:gap-4",
          /* It takes focus and the arrow keys drive it, so it says so. The
             ring is inset, because an outline around a box the height of
             the window would be a frame around the photographs. */
          "strip-scroll focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground/40",
          // Stacked: the cells run down the page, which scrolls as pages
          // do, with nothing hidden, nothing sliding in, and the words
          // selectable again.
          stack &&
            "max-sm:animate-none max-sm:flex-col max-sm:items-stretch max-sm:gap-10 max-sm:overflow-visible max-sm:select-auto",
          // Stacked, a full-bleed page still wants its words off the edge.
          bleed && stack && "max-sm:gap-0",
        )}
      >
        {children}
      </div>

      {/* The panel: a tick for every cell that asked for one, the one you
          are on inked and tall, and whatever the page counts beside it.
          Each tick is a control — the strip is long and a visitor who wants
          the last cell should not have to travel the whole sequence to reach
          it. A tick with a word shows it when it is the one you are on or
          the one under the pointer. */}
      <div
        className={cn(
          "mt-4 flex items-end gap-6 px-6 sm:px-10",
          stack && "max-sm:hidden",
        )}
      >
        {counter?.(at)}

        <div
          aria-hidden
          // `h-4` whether or not the ticks are in yet, so the strip above is
          // the same height before and after they are read.
          className="flex h-4 min-w-0 flex-1 items-end justify-between gap-px"
        >
          {ticks.map(({ i, word }, n) => {
            /* Words in the back half hang from the right of their tick and
               grow leftwards. Anchored left like the rest, a long one near
               the end ran past the edge of the window — and a page that can
               be scrolled sideways by ten pixels is a page that wobbles. */
            const end = n * 2 >= ticks.length;
            return (
              <button
                key={`tick-${i}`}
                type="button"
                tabIndex={-1}
                title={word}
                onClick={() => goTo(i)}
                className="group relative flex h-4 flex-1 items-end"
              >
                {word ? (
                  <span
                    className={cn(
                      "label pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap text-[0.625rem] text-muted-foreground transition-opacity duration-200",
                      end ? "right-0" : "left-0",
                      i === at
                        ? "opacity-100"
                        : "opacity-0 hoverable:group-hover:opacity-100",
                    )}
                  >
                    {word}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "block w-full rounded-full transition-[height,background-color] duration-200 ease-[var(--ease-out-strong)]",
                    i === at
                      ? "h-4 bg-foreground"
                      : "h-1.5 bg-foreground/20 hoverable:group-hover:bg-foreground/50",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
