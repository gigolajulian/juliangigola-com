import * as React from "react";
import { cn } from "@/lib/utils";
import { useDesk } from "./media";
import { centreOf } from "./shared";
import type { Tick } from "./use-reader";

/** How long an open chapter waits after the pointer has left it, in ms.
    Julian, having asked for a bigger target first: hold it open for a
    beat. A mouse running the length of the ruler drifts off it and back
    on inside a couple of hundred milliseconds, and a chapter that shut on
    the way past had to be found again. Four hundred forgives the drift
    without the rail feeling stuck to the pointer; coming back inside it
    is not a re-entry at all, because nothing shut. */
const LINGER = 400;

/**
 * The rail under the strip: its ticks or chapters, what the pointer is
 * over, and a press or a drag along it moving the strip (`glide`).
 */
export function useRail({
  scroller: scrollerRef,
  ticks,
  at,
  aim,
  setAim,
  over,
  setOver,
  overAway,
  setOverAway,
  map,
  chapters,
  router,
  glide,
  aimed: aimedRef,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  ticks: Tick[];
  at: number;
  aim: number | null;
  setAim: (aim: number | null) => void;
  over: number | null;
  setOver: (over: number | null) => void;
  overAway: number | null;
  setOverAway: (over: number | null) => void;
  map?: { name: string; href: string; here?: boolean }[];
  chapters: boolean;
  router: { push: (href: string) => void };
  glide: React.RefObject<(to: number) => void>;
  aimed: React.RefObject<string>;
}) {
  /* ── running a finger along the ruler ──
     Every tick is a jump already. What it was not is a thing you could
     read before you committed to it: a word appeared under a mouse, on
     ticks that had a word of their own, and a tablet has no hover at all.

     So the pointer says where it is and the release says go. Held down,
     the name under the pointer follows it along the rail; let go and the
     strip travels there. Nothing moves until then, because a rail that
     scrubbed the strip live would be the whole archive flying past under
     a thumb - and this is a map, not a shuttle.

     The word a tick shows is the word of its section, not its own. On a
     discipline page twelve of eighty four ticks carry a name; the rest
     are the covers under one, and the answer to "what is here" is the
     name of the chapter they belong to. */
  const rail = React.useRef<HTMLDivElement>(null);
  const held = React.useRef(false);
  /** Where the pointer was last seen along the rail, so a chapter that is
      still opening can be re-read without one. */
  const lastX = React.useRef<number | null>(null);
  /** The beat an open chapter is held for once the pointer has gone. */
  const linger = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(linger.current), []);
  /** For each tick, the last name at or before it. */
  const named = React.useMemo(
    () =>
      ticks.reduce<(string | undefined)[]>(
        (out, t, n) => [...out, t.word ?? out[n - 1]],
        [],
      ),
    [ticks],
  );

  /* ── the ruler in chapters ──
     Eighty four covers under twelve disciplines came out as eighty four
     ticks four pixels wide: a rail that was really a table of contents,
     drawn as a bar chart of how much work is in each pile. Julian asked
     for chapters, and then for equal ones - twelve ways of working, not
     twelve sizes of pile - with the projects appearing inside the one
     under the pointer.

     So the twelve share the width until one is asked for, and how far
     that one opens is how much is in it: Editorial's thirty three want
     room to be pointed at, Cover art's one does not. The bar is scored
     into its projects rather than beaded with them; a dot per project is
     a carousel indicator, and at thirty three of them it is a dotted
     line. */
  const chapterSegs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** The runs of `named`: one chapter per section, in order. */
  const groups = React.useMemo(() => {
    const out: {
      name?: string;
      from: number;
      to: number;
      /** A chapter that is elsewhere: it holds no ticks of this page, and
          a press on it travels to that page instead of along this one. */
      href?: string;
    }[] = [];
    named.forEach((word, n) => {
      const last = out.at(-1);
      if (last && last.name === word) last.to = n;
      else out.push({ name: word, from: n, to: n });
    });
    return out;
  }, [named]);
  /** Which tick the cell in the middle belongs to, and so which chapter
      is the one being read. */
  const atTick = Math.max(0, ticks.filter((t) => t.i <= at).length - 1);
  /** Where the rail draws itself: the live reading, or the end of a
      journey the rail itself started and the pictures are still making. */
  const lands = aim ?? atTick;
  /* The archive's own chapters, where a page has been handed them. This
     strip is one of them and takes all of its ticks; the others hold
     none and stand for the pages they lead to. */
  const away = React.useMemo(() => {
    if (!map?.length || !ticks.length) return null;
    return map.map((m) =>
      m.here
        ? { name: m.name, from: 0, to: ticks.length - 1 }
        : { name: m.name, from: -1, to: -1, href: m.href },
    );
  }, [map, ticks.length]);
  const chapterList = away ?? groups;
  const desk = useDesk();
  /* Two chapters are not a table of contents, and one is a rail with a
     single segment in it. Under three the plain ruler is the better
     instrument and nothing changes. */
  const chaptered = (chapters || !!away) && desk && chapterList.length > 2;
  /** The chapter the pointer is in, or null. */
  const openAt =
    over === null
      ? null
      : chapterList.findIndex((g) => over >= g.from && over <= g.to);
  /* `open` is taken in here - it is the ref holding `onOpen` - so the
     chapter under the pointer is named for what it is. */
  const openChapter = openAt !== null && openAt >= 0 ? openAt : null;

  /** How much room a chapter takes when it opens, as a share against the
      eleven that stay shut. A floor, or a one-project chapter would open
      to nothing; a ceiling, or Editorial would take the whole rail. */
  const opening = (count: number) => Math.min(Math.max(count / 3.5, 1.4), 7);

  /** And on the archive's rail, the share the chapter you are in takes,
      whichever one it is. Julian: every chapter opens to the same width.
      Its own share would have said how much work is in it, but there is
      only ever one open here and it is the page you are standing on, so
      the reading was Portraits at 164px against Editorial at 371 - the
      rail changing shape between two filters, which is the thing this was
      built to stop. Four of the fourteen shares, which leaves the other
      ten disciplines around a hundred pixels each. */
  const OPEN_SHARE = 4;

  /** Half the gap between two chapters, and so the inset from a chapter's
      own edge to the bar drawn inside it. */
  const CHAPTER_PAD = 4;

  /** Which chapter a pointer at `x` is over. The chapters tile the rail
      with no gap between them - the gap is drawn inside each one - so
      every x on the rail belongs to exactly one of them and there is
      nowhere to fall through. */
  const chapterAt = (x: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || !chaptered) return null;
    const g = chapterSegs.current.findIndex((el) => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x < r.right;
    });
    return g < 0 ? (x < box.left ? 0 : chapterList.length - 1) : g;
  };

  /** Which tick a pointer at `x` is over. In plain ticks they share the
      rail's width equally and this is arithmetic. In chapters they do not
      - the one under the pointer is wider than the rest, and as often as
      not the widths are still travelling - so the chapters are asked
      where they are. Twelve rectangles a move rather than eighty four. */
  const tickAt = (x: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || !ticks.length) return null;
    if (!chaptered) {
      const n = Math.floor(((x - box.left) / box.width) * ticks.length);
      return Math.max(0, Math.min(ticks.length - 1, n));
    }
    const g = chapterAt(x);
    if (g === null) return null;
    const r = chapterSegs.current[g]?.getBoundingClientRect();
    const here = chapterList[g];
    // A chapter that lives on another page has no tick of this one in it.
    if (!r || !here || here.href) return null;
    const count = here.to - here.from + 1;
    const w = Math.max(1, r.width - CHAPTER_PAD * 2);
    const c = Math.floor(((x - r.left - CHAPTER_PAD) / w) * count);
    return here.from + Math.max(0, Math.min(count - 1, c));
  };

  /* A chapter opening moves the cells out from under a pointer that never
     moved, so the ruler re-reads itself while the layout is travelling.
     `setOver` with the answer it already has costs a bail-out and no
     render, so this is twelve rectangles a frame for as long as a pointer
     is on the rail and nothing else. */
  const hit = React.useRef(tickAt);
  // After the render rather than during it: the loop wants the newest hit
  // test, and a ref written mid-render is a ref read before it is set.
  React.useEffect(() => {
    hit.current = tickAt;
  });
  const onRail = over !== null;
  /** Each chapter's colour on the rail, and so its neighbours'. */
  const chapterTints = chapterList.map((g) => tintOf(ticks.slice(g.from, g.to + 1)));
  /** The chapter the page is in, for the rail at rest (`rail-sum`). */
  const nowIn = chaptered
    ? chapterList.find((g) => !g.href && lands >= g.from && lands <= g.to)
    : undefined;
  /* Its fill follows the scroll exactly (Julian): from the chapter's first
     cell in the middle of the window to its last, written by hand so a
     scroll frame costs no render. */
  const sumFill = React.useRef<HTMLSpanElement>(null);
  const sumFrom = nowIn ? ticks[nowIn.from]?.i : undefined;
  const sumTo = nowIn ? (ticks[nowIn.to + 1]?.i ?? Infinity) - 1 : undefined;
  React.useEffect(() => {
    const el = scrollerRef.current;
    const fill = sumFill.current;
    if (!el || !fill || sumFrom === undefined || sumTo === undefined) return;
    const read = () => {
      const max = el.scrollWidth - el.clientWidth;
      const a = Math.max(0, centreOf(el, sumFrom) ?? 0);
      const b = Math.min(
        max,
        centreOf(el, Math.min(sumTo, el.children.length - 1)) ?? max,
      );
      const p = b > a ? (el.scrollLeft - a) / (b - a) : 1;
      // A clip and not a width: a width lays the rail out on every
      // scroll frame, a clip is only painted.
      fill.style.clipPath = `inset(0 ${100 - Math.min(1, Math.max(0, p)) * 100}% 0 0 round 9999px)`;
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    return () => el.removeEventListener("scroll", read);
  }, [scrollerRef, sumFrom, sumTo]);
  /** Starts the rail's re-reading loop again, when it has stopped. */
  const wakeRail = React.useRef(() => {});
  React.useEffect(() => {
    if (!chaptered || !onRail) return;
    let frame = 0;
    /* Frames in a row in which nothing moved. A pointer left resting
       on the rail kept this loop going for as long as it stayed
       there, 120 callbacks a second with nothing to do (measured on
       /portfolio). Once the chapters have finished opening, which is
       the 300ms of their `flex-grow` ease, it stops, and a move wakes
       it. */
    let calm = 0;
    let was = "";
    const step = () => {
      const x = lastX.current;
      const now = x !== null ? hit.current(x) : null;
      if (x !== null) setOver(now);
      /* A project's name is centred over its own cell, and the first cell
         of the first chapter is at the edge of the page: I WANNA BE A
         HUMAN, over Editorial's second cover, measured at -5px and lost
         its first letter off the side of the window. So the word is
         pushed back inside the rail here, where its width is known -
         a percentage in the markup cannot clamp against a word it has
         not measured. */
      const railEl = rail.current;
      const word = railEl?.querySelector<HTMLElement>("[data-word]");
      if (railEl && word) {
        const box = railEl.getBoundingClientRect();
        const seen = word.getBoundingClientRect();
        const half = seen.width / 2;
        const mid = seen.left + half;
        const want = Math.min(Math.max(mid, box.left + half), box.right - half);
        if (Math.abs(want - mid) > 0.5)
          word.style.left = `${
            parseFloat(getComputedStyle(word).left) + (want - mid)
          }px`;
      }
      /* Where every chapter stands, as the pointer and the word read it. */
      const key = `${now}:${chapterSegs.current
        .map((s) => s?.getBoundingClientRect().width.toFixed(1))
        .join(",")}`;
      calm = key === was ? calm + 1 : 0;
      was = key;
      frame = calm < 24 ? requestAnimationFrame(step) : 0;
    };
    wakeRail.current = () => {
      calm = 0;
      if (!frame) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      wakeRail.current = () => {};
    };
  }, [chaptered, onRail, setOver]);

  /** The chapter under `x` if it is another page, or null. Read on the way
      in and on the way out, so a drag that crosses one shows its name and
      a release on it goes there. */
  const awayAt = (x: number) => {
    const g = chapterAt(x);
    return g !== null && chapterList[g]?.href ? g : null;
  };

  const railDown = (e: React.PointerEvent<HTMLDivElement>) => {
    held.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(linger.current);
    lastX.current = e.clientX;
    setOverAway(awayAt(e.clientX));
    setOver(tickAt(e.clientX));
    wakeRail.current();
  };
  const railMove = (e: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(linger.current);
    lastX.current = e.clientX;
    wakeRail.current();
    const n = tickAt(e.clientX);
    setOverAway(awayAt(e.clientX));
    setOver(n);
    /* Held, so the shelf comes with the pointer rather than waiting for it
       to lift. Julian: allow dragging the bold part and going through the
       filters and the pages. Until now the rail was a preview - a drag
       along it told you where you would land and never showed you what was
       there, so the one control built for travelling the whole sequence
       could only be used one press at a time.

       `glide` retargets rather than restarting: each move sets a new
       destination and the speed is recomputed from where the travel has
       actually got to, so a sweep across eleven chapters is one continuous
       journey and not eleven interrupted ones. */
    if (held.current && n !== null) goTo(ticks[n].i);
  };
  const railUp = (e: React.PointerEvent<HTMLDivElement>) => {
    /* Where the word says, not where a fresh hit test says. The rail can
       still be settling under a pointer that has only just arrived on it,
       and read again at the moment of the press it answered for whichever
       cell had slid under the finger by then: measured on All work, the
       name over the rail read FROSTBITE and the press landed on
       LIGHTBEAM. `over` is what the name is drawn from and it is re-read
       every frame, so pressing takes you to the thing you can see. */
    const n = over ?? tickAt(e.clientX);
    const g = overAway ?? awayAt(e.clientX);
    held.current = false;
    lastX.current = null;
    window.clearTimeout(linger.current);
    setOver(null);
    setOverAway(null);
    /* A chapter of the archive that is not this page: the rail is a map of
       all of them, so pressing one is how you get there. Julian asked for
       exactly that. */
    const href = g === null ? undefined : chapterList[g]?.href;
    if (href) {
      router.push(href);
      return;
    }
    // A press that never moved is a press on a tick, which is the same
    // journey: both end here rather than in the button's own `onClick`.
    if (n !== null) {
      setAim(n);
      goTo(ticks[n].i);
    }
  };
  const railOut = () => {
    if (held.current) return;
    lastX.current = null;
    /* A press shuts the chapter at once - it has been answered, and the
       strip is already travelling. A pointer merely wandering off is
       given the beat, and a plain ruler has nothing to hold open. */
    window.clearTimeout(linger.current);
    setOverAway(null);
    if (!chaptered) return setOver(null);
    linger.current = window.setTimeout(() => setOver(null), LINGER);
  };

  /** Puts a cell in the middle of the window. */
  const goTo = (i: number) => {
    const el = scrollerRef.current;
    // The ruler moving the row is the visitor moving it: the aim is spent.
    aimedRef.current = "";
    const where = el ? centreOf(el, i) : null;
    if (where !== null) glide.current(where);
  };

  return {
    scroller: scrollerRef,
    rail,
    chaptered,
    nowIn,
    sumFill,
    chapterList,
    lands,
    onRail,
    away,
    openChapter,
    opening,
    OPEN_SHARE,
    chapterSegs,
    chapterTints,
    named,
    railDown,
    railMove,
    railUp,
    railOut,
  };
}

/* The panel: a tick for every cell that asked for one, the one you
   are on inked and tall, and whatever the page counts beside it.
   Each tick is a control - the strip is long and a visitor who wants
   the last cell should not have to travel the whole sequence to reach
   it. A tick with a word shows it when it is the one you are on or
   the one under the pointer. */
export function StripRail({
  rail: {
    scroller,
    rail,
    chaptered,
    nowIn,
    sumFill,
    chapterList,
    lands,
    onRail,
    away,
    openChapter,
    opening,
    OPEN_SHARE,
    chapterSegs,
    chapterTints,
    named,
    railDown,
    railMove,
    railUp,
    railOut,
  },
  stack,
  counter,
  pageCount,
  at,
  ticks,
  cue,
  over,
  overAway,
  still,
  aim,
}: {
  rail: ReturnType<typeof useRail>;
  stack: boolean;
  counter?: (at: number) => React.ReactNode;
  pageCount?: boolean;
  at: number;
  ticks: Tick[];
  cue: boolean;
  over: number | null;
  overAway: number | null;
  still: boolean;
  aim: number | null;
}) {
  return (
    <div
      className={cn(
        // The gap has to hold a tick word: 16px did not, and the word's
        // top two pixels sat inside the strip, over the bottom edge of
        // whatever cell was there.
        /* `min-h-5`, so the row is the same height with a tick's word or
           a client's mark in it and without one. It had drifted to
           `min-h-3` and the four pixels this was written to stop were
           being given up again, with worse consequences in the rack than
           on a strip: the row sits at 16 empty and 20 with a word, the
           strip above is `flex-1` and loses the difference, and a rack
           cell takes its width from the shelf's own height. Measured on
           Brand campaigns at 2000 - the rack went 919.4 to 915.4, every
           cell 338.97 to 337.38, the scrollable extent 1287 to 1274, all
           while a wheel was moving it. The ruler was reading a length
           that changed under it, which is why two of its segments lit at
           once near the end. */
        /* And paper under the rail. Julian: leave some white space on the
           bottom. The band finished 38px off the foot of a 900px window
           and the rail read as the last thing on the page rather than as
           something sitting on it. Padding and not a taller row: the
           rack reads the shelf's own height to work out a column's
           width, so anything that changes height mid-gesture moves every
           cell under the pointer - which is the bug `min-h-5` above was
           written to stop. A constant 16px moves nothing. */
        "strip-rail mt-6 flex min-h-5 items-end gap-6 px-6 pb-4 max-sm:mt-3 sm:px-10 tablet:mt-3 lying:mt-2",
        stack && "max-sm:hidden",
      )}
      /* Julian: one big bar, sectioned off (`rail-names` in
         `globals.css`). */
      data-rail-names={chaptered ? "always" : undefined}
    >
      {counter?.(at)}
      {pageCount && !counter && ticks.length ? (
        <p aria-hidden className="strip-count label shrink-0 tabular-nums text-muted-foreground">
          <span className="text-foreground">
            {String(Math.max(1, ticks.filter((t) => t.i <= at).length)).padStart(2, "0")}
          </span>
          {" / "}
          {String(ticks.length).padStart(2, "0")}
        </p>
      ) : null}
      {/* Where you are, for a reader who cannot see the inked tick. The
          ruler beside this is a row of pointer-only jump controls and
          stays hidden from assistive tech: given a role it became a
          landmark full of unnamed buttons, measured in Chromium, which
          does not treat a progressbar's children as presentational. So
          the position is said once, here, and nothing else changes. */}
      <span
        role="progressbar"
        aria-label="Position"
        aria-valuemin={1}
        aria-valuemax={ticks.length || 1}
        aria-valuenow={Math.max(1, ticks.filter((t) => t.i <= at).length)}
        aria-valuetext={
          ticks[Math.max(1, ticks.filter((t) => t.i <= at).length) - 1]
            ?.word ??
          `${Math.max(1, ticks.filter((t) => t.i <= at).length)} of ${
            ticks.length || 1
          }`
        }
        className="sr-only"
      />
      {/* The client's mark used to sit here, drawn for whichever cover
          was in the middle. It is gone. In the rack there is no middle -
          two rows of cells go by at once and the reading picked whatever
          happened to be centred, so Julian got client logos appearing and
          swapping at random as he scrolled. A mark that names the wrong
          project is worse than no mark. The prop and the
          map that fed it are gone with it. */}

      <div
        aria-hidden
        ref={rail}
        onPointerDown={railDown}
        onPointerMove={railMove}
        onPointerUp={railUp}
        onPointerCancel={railOut}
        onPointerLeave={railOut}
        // `h-2` whether or not the ticks are in yet, so the strip above is
        // the same height before and after they are read.
        /* `touch-action: none`, or the first millimetre of a drag along
           the rail is the page deciding the gesture was a scroll and
           taking it away. `py-2` is the thumb: the rail itself is eight
           pixels tall and the padding is hit area, not height. On a
           touch screen the `::before` takes the hit area to 44px: the 12px
           gap above the rail and the 16px foot below it, without moving
           a pixel of the drawing. */
        data-cue={cue ? "" : undefined}
        /* Julian: one word at the pointer, always, and on a rail
           that word is VIEW (`pointer-mark.tsx`). The names stay on the
           rail itself. */
        data-ring={over !== null || overAway !== null ? "View" : ""}
        className={cn(
          "rail-line relative flex h-2 min-w-0 flex-1 touch-none items-end py-2",
          "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-top-3 pointer-coarse:before:-bottom-4 pointer-coarse:before:content-['']",
          // In chapters the gap is drawn inside each one, so the twelve
          // tile the rail and the hit test has nowhere to fall through.
          chaptered ? "gap-0" : "justify-between gap-px",
        )}
      >
        {/* Hit area, and nothing else. The rail is sixteen pixels of
            line and Julian said it was hard to stay on one: a mouse
            running along it sideways drifts off it upwards and the
            chapter under it shuts. So the band reaches up into the
            twenty four pixels of empty gap above the rail - the
            covers end exactly there, and it takes none of them - and
            eight pixels into the footer's own padding below, which is
            blank. Sixteen pixels becomes forty eight and not one thing
            on the page moves.

            A descendant of the rail rather than a sibling, so leaving
            the rail's own box for it is not leaving the rail:
            `pointerleave` counts an element and its descendants as one
            place. Chapters only, where the pointer is a mouse - on a
            tablet this would be a strip of page that swallows a swipe
            on its way past. */}
        {chaptered ? (
          <span
            aria-hidden
            className="absolute -bottom-2 -top-6 left-0 right-0 z-10"
          />
        ) : null}
        {/* The drop, on every rail but the archive's (Julian put that
            one back as it was). */}
        {chaptered ? null : <RailFollow rail={rail} scroller={scroller} over={over} />}
        {/* Julian: unhovered, the archive's rail is About's one line,
            filled as far as the page has got through the discipline it
            is in. The line is the sections themselves, shrunk; this is
            only the fill and the name over them (`rail-sum` in
            `globals.css`). */}
        {nowIn ? (
          <span
            aria-hidden
            className="rail-sum pointer-events-none absolute inset-x-0 top-0 z-[1] h-2 rounded-full"
          >
            <span
              ref={sumFill}
              className="block h-full w-full rounded-full bg-foreground [clip-path:inset(0_100%_0_0)]"
            />
            <span className="rail-word label absolute bottom-full left-0 mb-2 whitespace-nowrap text-muted-foreground">
              {nowIn.name}
            </span>
          </span>
        ) : null}
        {chaptered
          ? chapterList.map((g, gi) => {
              const count = g.to - g.from + 1;
              const here = lands >= g.from && lands <= g.to;
              /* The chapter you are standing in is open from the start
                 rather than on being pointed at. Shut, it said which
                 discipline you were in and nothing about where in it:
                 Julian asked for an indicator inside the rail showing
                 the position on the page, and a chapter has to be open
                 before a position can be marked in it.

                 But not while a pointer is on the rail. The open
                 chapter follows the page, so a rail that kept following
                 it changed shape between aiming at a project and
                 pressing it: measured on All work, a press on ÆGIS
                 while the rail was still settling landed on ASTRAL
                 ALLURE, four cells away. On the rail, the pointer is
                 the only thing that opens a chapter, and what you see
                 is what you press. */
              /* A filter's rail is exempt: its one chapter with work
                 in it never changes as the page runs, so there is
                 nothing to pulse and the position stays readable while
                 you scroll. */
              const mine =
                here &&
                !g.href &&
                !onRail &&
                (!!away || still || aim !== null);
              const shown = openChapter === gi || mine;
              /* Which cell of an open chapter carries the ink: the one
                 under the pointer where the pointer is in this chapter,
                 and otherwise where the page stands. So your own
                 chapter keeps its place while another is being read. */
              const mark =
                over !== null && over >= g.from && over <= g.to
                  ? over
                  : mine
                    ? lands
                    : null;
              /* Words in the back half hang from the right of their
                 chapter and grow leftwards, as the ticks' own did: a
                 long one near the end ran past the edge of the window. */
              const end = gi * 2 >= chapterList.length;
              /* The chapter names itself until one of its projects is
                 under the pointer, and then the project has the slot.
                 One word above one chapter, never two competing for the
                 same inch of line. */
              const named1 = shown && over !== null;
              const word = named1 ? (ticks[over].name ?? g.name) : g.name;
              return (
                <div
                  /* Every chapter away from this page starts at -1, so
                     those are told apart by where they lead. */
                  key={`chapter-${g.href ?? g.from}`}
                  ref={(el) => {
                    chapterSegs.current[gi] = el;
                  }}
                  style={
                    {
                      flexGrow: shown
                        ? mine
                          ? OPEN_SHARE
                          : opening(count)
                        : 1,
                      /* Each stretch runs into its neighbours' colours
                         at its edges, so the bar is one blend (Julian:
                         smooth). */
                      "--tint": chapterTints[gi],
                      "--tint-prev": chapterTints[gi - 1] ?? chapterTints[gi],
                      "--tint-next": chapterTints[gi + 1] ?? chapterTints[gi],
                    } as React.CSSProperties
                  }
                  /* Which thumb it carries in the control
                     (`globals.css`): where you are, or a discipline
                     elsewhere under the pointer. */
                  data-tone={
                    shown
                      ? "open"
                      : here
                        ? "lit"
                        : overAway === gi
                          ? "near"
                          : undefined
                  }
                  className={cn(
                    "rail-chapter relative flex h-2 min-w-0 shrink basis-0 items-end px-1",
                    /* Eased while the page is what moves it, instant
                       while a pointer is on it. Three hundred
                       milliseconds of growth under a finger is three
                       hundred milliseconds in which the cell being
                       aimed at slides away: the name over the rail read
                       FROSTBITE and the press landed on LIGHTBEAM, and
                       a press near the left edge of a chapter that was
                       still opening landed on the first project of it,
                       which is what Julian saw. Opened at once, the
                       rail is still before it is aimed at. */
                    !onRail &&
                      "transition-[flex-grow] duration-300 ease-[var(--ease-out-strong)]",
                  )}
                >
                  {word ? (
                    <span
                      /* A project's name stands over the project, not
                         over the left edge of the chapter it is in: the
                         word is pointing at something and should point
                         at it. The chapter's own name keeps the ticks'
                         old anchoring. */
                      data-word={named1 ? "" : undefined}
                      style={
                        named1
                          ? {
                              left: `${((over - g.from + 0.5) / count) * 100}%`,
                            }
                          : undefined
                      }
                      className={cn(
                        /* `mb-2`, not `mb-1`. Julian: put some space
                           between the rail and the word that comes up
                           over it. Four pixels had the word sitting on
                           the bars, so a long title read as one object
                           with the graphic under it. Eight separates
                           them and still clears the covers: the word
                           rises into the 24px above the rail, and at
                           twelve pixels plus eight it reaches 20 with
                           four to spare. */
                        "rail-word label pointer-events-none absolute bottom-full mb-2 whitespace-nowrap transition-opacity duration-200",
                        /* The word grows by a scale (globals.css), so
                           it grows from the edge it is pinned to. */
                        named1
                          ? "origin-bottom [translate:-50%_0]"
                          : end
                            ? "origin-bottom-right right-1"
                            : "origin-bottom-left left-1",
                        shown
                          ? "text-foreground opacity-100"
                          : /* A discipline the pointer is running along
                               on its way somewhere else says its name,
                               because its name is the whole of what it
                               offers: it is a door, not a chapter of
                               this page. */
                            overAway === gi
                            ? "text-foreground opacity-100"
                            : over !== null || overAway !== null
                              ? "text-muted-foreground opacity-0"
                              : here
                                ? "text-muted-foreground opacity-100"
                                : "text-muted-foreground opacity-0",
                      )}
                    >
                      {word}
                    </span>
                  ) : null}
                  {/* Open, the chapter drops back to the middle tone -
                      the one you are standing in included. Once it is
                      open the ink means the project under the pointer,
                      and a bar that is already solid has nothing left to
                      say with it. */}
                  <div
                    className={cn(
                      /* Always the full eight pixels tall and scaled
                         down from the bottom, rather than a height that
                         moves: a height tween lays the whole rail out
                         again on every frame, a scale is drawn by the
                         compositor. */
                      "rail-bar flex h-2 w-full origin-bottom rounded-full transition-[scale,background-color] duration-200 ease-[var(--ease-out-strong)]",
                      shown
                        ? /* The cue nudges the bar that says where you
                             are, and on the archive's rail that is this
                             open chapter rather than a lit one. */
                          cn(
                            "scale-y-100 bg-foreground/25",
                            mine && "rail-lit",
                          )
                        : here
                          ? "rail-lit scale-y-50 bg-foreground"
                          : overAway === gi
                            ? "scale-y-75 bg-foreground/40"
                            : "scale-y-50 bg-foreground/20",
                    )}
                  >
                    {Array.from({ length: count }, (_, k) => (
                      <span
                        key={`cell-${g.from + k}`}
                        className={cn(
                          /* The mark moves without easing its colour.
                             Eased both ways, a fast scroll left a trail
                             of half-lit cells behind it: Julian's
                             recording showed two at once. */
                          "h-full min-w-0 flex-1 transition-[box-shadow] duration-200 ease-[var(--ease-out-strong)]",

                          k === 0 && "rounded-l-full",
                          k === count - 1 && "rounded-r-full",
                          // A cut the colour of the page, not a gap and
                          // not a dot: the chapter stays one bar and is
                          // scored into the work inside it.
                          shown &&
                            k < count - 1 &&
                            "shadow-[inset_-1px_0_0_0_var(--background)]",
                          shown && mark === g.from + k && "bg-foreground",
                        )}
                        style={{ "--tint": ticks[g.from + k]?.tint } as React.CSSProperties}
                      />
                    ))}
                  </div>
                  {/* Julian: the discipline inside its own section, or
                      the project under the pointer in an open one
                      (`rail-name`, `globals.css`). */}
                  <span aria-hidden className="rail-name label">
                    {word}
                  </span>
                </div>
              );
            })
          : ticks.map(({ i }, n) => {
              /* Words in the back half hang from the right of their tick and
             grow leftwards. Anchored left like the rest, a long one near
             the end ran past the edge of the window - and a page that can
             be scrolled sideways by ten pixels is a page that wobbles. */
              const end = n * 2 >= ticks.length;
              return (
                <button
                  key={`tick-${i}`}
                  type="button"
                  tabIndex={-1}
                  /* Never pressed nor reached by Tab, so not read out as
                     a row of nameless buttons either. */
                  aria-hidden
                  title={named[n]}
                  // The rail above takes the press, so this is a target and
                  // not a handler: two of them would travel twice.
                  className="group pointer-events-none relative flex h-2 flex-1 items-end"
                >
                  {named[n] ? (
                    <span
                      className={cn(
                        "rail-tick-word label pointer-events-none absolute bottom-full mb-1 whitespace-nowrap text-[0.625rem] transition-opacity duration-200",
                        end ? "right-0" : "left-0",
                        over === n
                          ? "text-foreground opacity-100"
                          : over !== null
                            ? "text-muted-foreground opacity-0"
                            : i === at
                              ? "text-muted-foreground opacity-100"
                              : "text-muted-foreground opacity-0",
                      )}
                    >
                      {named[n]}
                    </span>
                  ) : null}
                  <span
                    data-ink={i === at ? "" : undefined}
                    data-mark=""
                    className={cn(
                      /* The position moves from tick to tick without easing
                     its colour, and only the lit tick's height eases up.
                     With the colour easing over 200ms both ways a fast
                     scroll lit several at a time, the ghosts Julian
                     recorded on NOVA reading 03 and 09 together. */
                      "block h-2 w-full origin-bottom rounded-full ease-[var(--ease-out-strong)]",
                      i === at
                        ? "rail-lit scale-y-100 bg-foreground transition-[scale] duration-150"
                        : over === n
                          ? "scale-y-75 bg-foreground/40 transition-[scale,background-color] duration-200"
                          : "scale-y-50 bg-foreground/20",
                    )}
                  />
                </button>
              );
            })}
      </div>
    </div>
  );
}

/** A discipline's colour on the rail: the most saturated of its
    projects' accents (`scripts/make-accents.mjs`). */
const tintOf = (cells: { tint?: string }[]) => {
  const sat = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return Math.max(...c) - Math.min(...c);
  };
  let best: string | undefined;
  for (const { tint } of cells)
    if (tint && (!best || sat(tint) > sat(best))) best = tint;
  return best;
};

/** The quiet after the last scroll frame that counts as settled. */
const SETTLE_MS = 120;
/** How near its screen the page is, as a share of the way, when the drop
    lets go of the one it left: before the page's ease has run out. */
const NEAR = 0.05;
/** How far the drop leans toward a mark under the pointer. */
const LEAN = 0.25;

/* ── the drop riding the scroll ──
   Julian asked for the drop to move with the page and keep its liquid.
   So it is not sent after the lit mark: every frame of the scroll puts
   it between the two marks the page is between, as far along as the page
   is. The stretch and the snap are its own (below). It is drawn plainly:
   `liquid-gooey` traced it on a spring of its own that ran up to 20px
   behind, the tail reaching back past the mark it was held on, and with
   its stretch and droplet off it added nothing else (measured
   2026-10-10). For anybody who asked for less motion there is no stretch
   and no snap: exactly where the page is, nothing of its own moving. */
function RailFollow({
  rail,
  scroller,
  over,
}: {
  rail: React.RefObject<HTMLDivElement | null>;
  scroller: React.RefObject<HTMLDivElement | null>;
  /** The mark under the pointer, which the drop leans toward. */
  over: number | null;
}) {
  const box = React.useRef<HTMLSpanElement>(null);
  const drop = React.useRef<HTMLDivElement>(null);
  const [still] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  /* Where the page last came to rest, as a mark, and the drop's edges as
     drawn. Kept across renders. */
  const home = React.useRef<number | null>(null);
  const overRef = React.useRef(over);
  React.useEffect(() => {
    overRef.current = over;
  });
  const edges = React.useRef({ left: 0, right: 0, vl: 0, vr: 0, frame: 0, busy: false });
  /* After every render as well as on every scroll: a cell arriving, or
     the lit mark changing, moves the marks under it.

     Julian, 2026-10-10: while the page is moving the drop is a sling
     being drawn, held on the mark it left and stretched only the way the
     page is going, to where the page is now. Once the page has settled it
     lets go and springs onto the mark it landed on, overshooting a little
     before it sets; a page that went back slings back home. Under less
     motion there is no stretch and no snap: the drop is where the page is. */
  React.useEffect(() => {
    const r = rail.current;
    const el = scroller.current;
    if (!r || !el) return;
    const e = edges.current;
    let rest = 0;
    const draw = () => {
      const b = box.current;
      const d = drop.current;
      const m = r.querySelector<HTMLElement>("[data-mark]");
      if (!b || !d || !m) return;
      const o = b.getBoundingClientRect();
      const ht = 8;
      d.style.width = `${Math.max(ht, e.right - e.left)}px`;
      d.style.height = `${ht}px`;
      d.style.transform = `translate(${e.left - o.left}px, ${m.getBoundingClientRect().bottom - ht - o.top}px)`;
    };
    /* The let-go: each edge on a spring to the mark, a little under
       critical, so it passes the mark and comes back (Apple's 0.8 for a
       flung drawer; less here, the snap is the point). */
    const sling = (left: number, right: number) => {
      cancelAnimationFrame(e.frame);
      const RESPONSE = 0.24;
      const ZETA = 0.55;
      const k = (2 * Math.PI / RESPONSE) ** 2;
      const c = (4 * Math.PI * ZETA) / RESPONSE;
      let last = 0;
      const step = (t: number) => {
        const dt = last ? Math.min(0.032, (t - last) / 1000) : 1 / 60;
        last = t;
        e.vl += (-k * (e.left - left) - c * e.vl) * dt;
        e.vr += (-k * (e.right - right) - c * e.vr) * dt;
        e.left += e.vl * dt;
        e.right += e.vr * dt;
        const done =
          Math.abs(e.left - left) + Math.abs(e.right - right) < 0.3 &&
          Math.abs(e.vl) + Math.abs(e.vr) < 5;
        if (done) {
          e.left = left;
          e.right = right;
          e.vl = e.vr = 0;
          e.frame = 0;
        } else e.frame = requestAnimationFrame(step);
        draw();
      };
      e.frame = requestAnimationFrame(step);
    };
    const place = (moving: boolean) => {
      const marks = Array.from(r.querySelectorAll<HTMLElement>("[data-mark]"));
      if (!marks.length) return;
      // Where the scroll puts each marked cell in the middle of the window.
      const stops = (Array.from(el.children) as HTMLElement[])
        .flatMap((c, i) => (c.dataset.tick !== undefined ? [i] : []))
        .map((i) => centreOf(el, i) ?? 0);
      const x = el.scrollLeft;
      let k = 0;
      while (k < stops.length - 2 && stops[k + 1] <= x) k++;
      const span = (stops[k + 1] ?? stops[k]) - stops[k];
      const p = span > 0 ? Math.min(1, Math.max(0, (x - stops[k]) / span)) : 0;
      const a = marks[k].getBoundingClientRect();
      const z = (marks[k + 1] ?? marks[k]).getBoundingClientRect();
      // The page's place on the rail, between two marks.
      const left = a.left + (z.left - a.left) * p;
      const right = left + a.width + (z.width - a.width) * p;
      const here = p < 0.5 ? k : Math.min(k + 1, marks.length - 1);
      const h = home.current !== null ? marks[home.current]?.getBoundingClientRect() : undefined;
      if (still || !h) {
        // Less motion, or nothing to hold on to yet: where the page is.
        home.current = here;
        cancelAnimationFrame(e.frame);
        e.frame = 0;
        Object.assign(e, { left, right, vl: 0, vr: 0 });
      } else if (moving && Math.min(p, 1 - p) < NEAR && here !== home.current) {
        /* Nearly there: let go now, onto the mark the page is coming to
           rest on, rather than once its ease has run out. */
        home.current = here;
        const m = marks[here].getBoundingClientRect();
        sling(m.left, m.right);
        return;
      } else if (moving && Math.min(p, 1 - p) < NEAR) {
        // Let go already, or never left: the snap has it.
        if (e.frame) return;
        const m = marks[here].getBoundingClientRect();
        Object.assign(e, { left: m.left, right: m.right });
      } else if (moving) {
        // Drawn: held on the mark it left, reaching the way the page goes.
        cancelAnimationFrame(e.frame);
        e.frame = 0;
        e.vl = e.vr = 0;
        if (left >= h.left) {
          e.left = h.left;
          e.right = Math.max(right, h.right);
        } else {
          e.left = left;
          e.right = h.right;
        }
      } else {
        // Settled: let go, onto the mark the page is on, leaning toward
        // the mark under the pointer if there is one.
        home.current = here;
        const m = marks[here].getBoundingClientRect();
        let l = m.left;
        let rr = m.right;
        const t = overRef.current !== null && overRef.current !== here ? marks[overRef.current] : undefined;
        if (t) {
          const q = t.getBoundingClientRect();
          if (q.left > m.left) rr += (q.right - m.right) * LEAN;
          else l -= (m.left - q.left) * LEAN;
        }
        if (Math.abs(e.left - l) + Math.abs(e.right - rr) > 1 || e.frame) sling(l, rr);
        return;
      }
      draw();
    };
    const onScroll = () => {
      e.busy = true;
      place(true);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        e.busy = false;
        place(false);
      }, SETTLE_MS);
    };
    const onResize = () => place(false);
    // A render mid-move (the lit mark changing) is not a landing.
    if (e.busy) {
      rest = window.setTimeout(() => {
        e.busy = false;
        place(false);
      }, SETTLE_MS);
    } else place(false);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(rest);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  });
  return (
    <span ref={box} aria-hidden data-follow="" className="pointer-events-none absolute inset-0 z-[5]">
      <div ref={drop} className="absolute left-0 top-0 rounded-full bg-foreground" />
    </span>
  );
}
