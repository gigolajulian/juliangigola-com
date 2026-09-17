"use client";

import * as React from "react";
import loader from "../image-loader";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";
import { StripPage, StripHead } from "@/components/strip-page";
import {
  markFilter,
  markLane,
  StripView,
  type StripViewMode,
} from "@/components/strip";

/* ── the frame around the work ────────────────────────────────────
 * The head and the chip row, mounted once for the whole of /work, its
 * category pages and the video page — the route group `(index)` puts
 * them under one layout, and this is that layout's client half.
 *
 * Julian: "when switching through filters don't reload everything, just
 * change the ones needed". Each filter is still its own route, so it can
 * be linked and indexed, but the layout persists across the navigation
 * and only the words change; what the page renders under the chips is
 * what leaves and arrives.
 *
 * Which filter is showing is read from the route, not passed down: a
 * layout does not see its children's params, but a client component in
 * it can read the selected segments, and `heads` carries the title and
 * the count for every filter the layout could be showing.
 *
 * A chip is a route, from every page, always. It used to be two controls
 * wearing one shape: on /work it was an anchor to a hash and scrolled the
 * strip, on a category page it was a link and swapped the page. Measured
 * on the live site, the same click was a 24,527px glide lasting 2.3s in
 * one place and a 62ms swap in the other, the row went on filling `All`
 * however deep into Portraits you had travelled, and `All` itself did
 * nothing at all on /work - it pointed at `#work`, and the cell carrying
 * that hash left with the title cell. One behaviour, and the route is
 * what says which chip is lit.
 *
 * `/work#places` still opens on Places: the cells keep their hashes and
 * the strip still listens for `hashchange`. Nothing in the row writes one
 * any more.
 * ─────────────────────────────────────────────────────────────── */

/* ── strip or sheet, remembered ───────────────────────────────────
 * The way somebody wants to look at a body of work is a preference, not a
 * step to repeat on every visit, so the choice is kept.
 *
 * A store read through `useSyncExternalStore` rather than state set in an
 * effect: the server has no `localStorage` and must draw the strip, the
 * browser knows better a moment later, and this is the one hook that says
 * exactly that - `getServerSnapshot` for the render that has to match the
 * HTML, `getSnapshot` from then on. `useWide` in `strip.tsx` reads the
 * media query the same way.
 */
const VIEW_KEY = "work-view";

let watching: (() => void)[] = [];

const readView = (): StripViewMode => {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "strip";
  } catch {
    // Private browsing: it works, it is simply not remembered.
    return "strip";
  }
};

const subscribeView = (onChange: () => void) => {
  watching.push(onChange);
  // The same person in another tab of the same site.
  window.addEventListener("storage", onChange);
  return () => {
    watching = watching.filter((w) => w !== onChange);
    window.removeEventListener("storage", onChange);
  };
};

const chooseView = (next: StripViewMode) => {
  try {
    window.localStorage.setItem(VIEW_KEY, next);
  } catch {
    // As above.
  }
  for (const w of watching) w();
};

export type Head = {
  title: string;
  aside: string;
  /** How many things are behind this filter, for the chip. */
  count: number;
  /**
   * Whether this filter can be shown as a sheet.
   *
   * A list of projects can: every cell is a cover, and a grid of covers is
   * the same information laid out differently. A discipline that is one
   * gallery cannot, and neither can the films or the cover art rack - those
   * cells are a photo essay, a reel and a two-row catalogue, each built for
   * a strip, and squared off into a grid they collapse to a line. The
   * toggle is not offered where it has nothing to offer.
   */
  sheet: boolean;
};

/** One picture the lane can pass by: a cover, a frame or a poster. */
export type PassPic = {
  src: string;
  width: number;
  height: number;
  color: string;
};

/* ── the lane ─────────────────────────────────────────────────────
 * A chip is pressed and the row travels as one strip: the cells on screen
 * slide off the way the pressed chip lies from the lit one, the pictures
 * of every filter between the two pass by after them, and the pressed
 * filter's own row follows them in and lands, all at one speed, with no
 * fade anywhere. Julian asked for the projects to seem loaded and the
 * photographs between to pass quickly, and then for no fade: the row is
 * one thing moving.
 *
 * The cells that slide off are clones of the ones on screen, so they are
 * the same pictures, already decoded; the cells off screen are not cloned,
 * because a clone of a lazy picture is a fetch. The pictures between are
 * the 640px rung, one that already exists for every cover (it is what a
 * phone gets), so nothing here asks the resizer for a new size. Web
 * Animations rather than a view transition: a snapshot cannot show
 * pictures that were never on the page. The new row is real: when it
 * mounts (`WorkShell` watches for it) it is put on the same animation at
 * the lane's current time, at the far end of the lane's content, so it
 * follows the last picture in with the same motion and stops at nought.
 * ─────────────────────────────────────────────────────────────── */
type Lane = {
  slide: Animation;
  /** Where the new row starts, relative to the row's box. */
  rowFrom: number;
  duration: number;
  ease: string;
  done: () => void;
};

const LANE_RUNG = 640;
const laneSrc = (p: PassPic) => loader({ src: p.src, width: LANE_RUNG });

function runLane(
  box: HTMLElement,
  between: PassPic[],
  way: 1 | -1,
): Lane | null {
  const scroller = box.querySelector<HTMLElement>(".strip-scroll");
  if (!scroller) return null;
  const laneRect = box.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(scroller).columnGap) || 12;

  const lane = document.createElement("div");
  lane.className = "pass-lane";
  const inner = document.createElement("div");
  inner.className = "pass-lane-inner";
  inner.style.gap = `${gap}px`;

  // The cells on screen, as they stand.
  const kept: HTMLElement[] = [];
  let firstLeft = 0;
  for (const cell of Array.from(scroller.children) as HTMLElement[]) {
    const r = cell.getBoundingClientRect();
    if (r.right <= 0 || r.left >= window.innerWidth || r.width === 0) continue;
    if (!kept.length) firstLeft = r.left;
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.style.width = `${r.width}px`;
    clone.style.flex = "0 0 auto";
    kept.push(clone);
  }
  const old = document.createElement("div");
  old.className = "pass-lane-inner";
  old.style.gap = `${gap}px`;
  old.append(...kept);

  const pass = document.createElement("div");
  pass.className = "pass-lane-inner";
  pass.style.gap = `${gap}px`;
  for (const p of between) {
    const cell = document.createElement("div");
    cell.className = "pass-lane-cell";
    cell.style.aspectRatio = `${p.width} / ${p.height}`;
    cell.style.backgroundColor = p.color;
    const img = document.createElement("img");
    img.src = laneSrc(p);
    img.alt = "";
    img.decoding = "sync";
    cell.append(img);
    pass.append(cell);
  }

  inner.append(...(way > 0 ? [old, pass] : [pass, old]));
  lane.append(inner);
  box.append(lane);

  const passWidth = pass.offsetWidth;
  const total = inner.scrollWidth;
  const laneWidth = laneRect.width;
  const start =
    way > 0
      ? firstLeft - laneRect.left
      : firstLeft - laneRect.left - passWidth - (passWidth ? gap : 0);
  /* Forward, the content leaves to the left by its whole width and a gap,
     and the new row, which starts a gap past its end, lands at nought.
     Back, the content leaves to the right, and the new row starts a
     window's width to the left of it and lands at nought the same. */
  const end = way > 0 ? -(total + gap) : laneWidth;
  const rowFrom = way > 0 ? start + total + gap : start - laneWidth;
  const duration = Math.min(520 + between.length * 70, 1300);
  // Fast through the middle, easing out at the end: the pictures between
  // are glimpsed, the row that follows them settles.
  const ease = "cubic-bezier(0.45, 0, 0.15, 1)";
  const slide = inner.animate(
    [{ transform: `translateX(${start}px)` }, { transform: `translateX(${end}px)` }],
    { duration, easing: ease, fill: "forwards" },
  );
  /* The real row is hidden under its clones for the trip, or it showed
     through them standing still until its page swapped; back if it is
     still there when the lane ends, which is a navigation that failed. */
  scroller.style.visibility = "hidden";
  const done = () => {
    lane.remove();
    if (scroller.isConnected) scroller.style.removeProperty("visibility");
  };
  slide.finished.then(done).catch(() => {});
  return { slide, rowFrom, duration, ease, done };
}

/** The new row, put on the lane's motion at the lane's current time. */
function followLane(scroller: HTMLElement, lane: Lane) {
  const at = Number(lane.slide.currentTime ?? 0);
  if (at >= lane.duration) return;
  const ride = scroller.animate(
    [
      { transform: `translateX(${lane.rowFrom}px)` },
      { transform: "translateX(0px)" },
    ],
    { duration: lane.duration, easing: lane.ease, fill: "backwards" },
  );
  ride.currentTime = at;
}

/* What the row would fetch for a cover at this window, so the warm-up asks
   for the same file the row does and not one more size. Mirrors the
   `sizes` in `cover-cell.tsx`: the strip's height by the cover's ratio,
   two thirds of it on a 3x screen. */
const RUNGS = [128, 256, 640, 1080, 1280, 1920, 2500];
const rowSrc = (p: PassPic) => {
  const dpr = window.devicePixelRatio || 1;
  const css = (window.innerHeight - 160) * (p.width / p.height) * (dpr >= 2.5 ? 0.667 : 1);
  const need = css * dpr;
  const rung = RUNGS.find((r) => r >= need) ?? RUNGS[RUNGS.length - 1];
  return loader({ src: p.src, width: rung });
};

export function WorkShell({
  heads,
  categories,
  passes,
  children,
}: {
  /** By filter key: "all", a category slug, or "video". */
  heads: Record<string, Head>;
  categories: CategoryLink[];
  /** By the same key: the pictures the lane passes by. */
  passes: Record<string, PassPic[]>;
  children: React.ReactNode;
}) {
  const rowBox = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<Lane | null>(null);

  /* The new row mounts some time after the press, when its page arrives;
     the moment it does, it joins the lane. */
  React.useEffect(() => {
    const box = rowBox.current;
    if (!box) return;
    const watch = new MutationObserver(() => {
      const lane = laneRef.current;
      if (!lane) return;
      const scroller = box.querySelector<HTMLElement>(".strip-scroll");
      if (!scroller || scroller.dataset.arrive !== "lane") return;
      if (scroller.dataset.riding !== undefined) return;
      scroller.dataset.riding = "";
      followLane(scroller, lane);
    });
    watch.observe(box, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);

  /* The warm-up: on a desktop with a pointer and no request to save data,
     once the page is idle, every filter's lane pictures and the two covers
     its row opens on are fetched and decoded, so a filter pressed later
     is there at once. A phone is left alone. */
  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const warm = () => {
      for (const pics of Object.values(passes)) {
        for (const p of pics) new Image().src = laneSrc(p);
        for (const p of pics.slice(0, 2)) new Image().src = rowSrc(p);
      }
    };
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(warm, { timeout: 4000 }) : window.setTimeout(warm, 1500);
    return () => {
      const cancel = (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (idle && cancel) cancel(handle);
      else window.clearTimeout(handle);
    };
  }, [passes]);

  const segments = useSelectedLayoutSegments();
  // [] on /work, ["category", slug] on a discipline, ["video"] on the films.
  const key = segments[1] ?? segments[0] ?? "all";
  const head = heads[key] ?? heads.all;
  const all = key === "all";

  /* The filters in the order of the row, so the lane knows which lie
     between the lit chip and the pressed one; nearest first, whichever
     way it goes. */
  const order = React.useMemo(
    () => ["all", ...categories.map((c) => c.slug)],
    [categories],
  );
  const lane = (to: string, way: 1 | -1) => {
    const box = rowBox.current;
    if (!box) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = order.indexOf(key);
    const b = order.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    const slugs = order.slice(Math.min(a, b) + 1, Math.max(a, b));
    if (way < 0) slugs.reverse();
    /* Two pictures from each filter passed, ten at most: the first cut
       took four of each, thirty six cells and twenty five thousand pixels
       in a second, which is a smear. The pressed filter's real row follows
       the last of them in. */
    const between = slugs
      .flatMap((s) => (passes[s] ?? []).slice(0, 2))
      .slice(-10);
    laneRef.current?.done();
    const lane = runLane(box, between, way);
    if (!lane) return;
    markLane();
    laneRef.current = lane;
    lane.slide.finished
      .then(() => {
        if (laneRef.current === lane) laneRef.current = null;
      })
      .catch(() => {});
  };

  /* From sm up the row is one line that scrolls, so eleven chips cost
     25px at any width. On a phone it wraps instead: a line that scrolls
     is a line a thumb swipes the filters out of, and the filters are the
     one thing on the page that has to stay put.
     A line that scrolls hides what is off the end, so the chosen chip is
     put in the middle of it whenever the filter changes: arriving on
     Places with the row showing Editorial through Portraits would be the
     same lie the old active state told. */
  /* It is the layout that holds the view, and the layout survives a filter
     change: choose Grid, then choose Portraits, and you are in the grid
     looking at portraits. */
  const chosen = React.useSyncExternalStore(
    subscribeView,
    readView,
    () => "strip" as StripViewMode,
  );
  /* A filter that cannot be a sheet is a strip whatever was chosen, and the
     choice is kept: walk from Editorial's grid through Places and back, and
     Editorial is still a grid. */
  const sheet = head.sheet;
  const view: StripViewMode = sheet ? chosen : "strip";

  const row = React.useRef<HTMLUListElement>(null);
  const lit = React.useRef<HTMLLIElement>(null);
  const pill = React.useRef<HTMLSpanElement>(null);
  /* The row is a thing you can take hold of.
     Eleven chips do not fit a laptop, so the row scrolls; a row that
     scrolls and cannot be dragged is a row most people never reach the end
     of, because a mouse has no sideways wheel. Held, it goes with the hand;
     let go with speed, it carries on and runs out under the same friction
     the strip uses. A press that moved is not a press: the click that
     follows a drag is swallowed, or letting go over Portraits would filter
     to portraits. */
  React.useEffect(() => {
    const r = row.current;
    if (!r) return;
    let down = false;
    let from = 0;
    let at = 0;
    let last = 0;
    let when = 0;
    let speed = 0;
    let glide = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (r.scrollWidth <= r.clientWidth) return;
      down = true;
      from = e.clientX;
      at = r.scrollLeft;
      last = e.clientX;
      when = performance.now();
      speed = 0;
      cancelAnimationFrame(glide);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const travel = e.clientX - from;
      /* Three pixels of slop, so a press with a shaking hand is still a
         press - and the pointer is captured only once it is a drag, never
         on the way down. A captured pointer sends the click that follows to
         whatever is holding the capture, so capturing a press would mean
         every chip's click arriving at the row instead of the chip, and no
         filter ever changing. */
      if (Math.abs(travel) > 3 && !r.hasAttribute("data-dragged")) {
        r.toggleAttribute("data-dragged", true);
        r.setPointerCapture(e.pointerId);
      }
      r.scrollLeft = at - travel;
      const now = performance.now();
      const gap = now - when;
      if (gap > 0) speed = (e.clientX - last) / gap;
      last = e.clientX;
      when = now;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      // A flick keeps going and runs out: `TAU` is the strip's own figure.
      let v = -speed;
      const TAU = 180;
      let then = performance.now();
      const run = () => {
        const now = performance.now();
        const dt = now - then;
        then = now;
        r.scrollLeft += v * dt;
        v *= Math.exp(-dt / TAU);
        if (Math.abs(v) > 0.02) glide = requestAnimationFrame(run);
      };
      if (Math.abs(v) > 0.05) glide = requestAnimationFrame(run);
      // After the click this release is about to fire, not before.
      requestAnimationFrame(() => r.removeAttribute("data-dragged"));
    };
    const swallow = (e: MouseEvent) => {
      if (!r.hasAttribute("data-dragged")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    r.addEventListener("pointerdown", onDown);
    r.addEventListener("pointermove", onMove);
    r.addEventListener("pointerup", onUp);
    r.addEventListener("pointercancel", onUp);
    r.addEventListener("click", swallow, true);
    // The browser must not pick the chips up and carry them instead.
    const noDrag = (e: DragEvent) => e.preventDefault();
    r.addEventListener("dragstart", noDrag);
    return () => {
      cancelAnimationFrame(glide);
      r.removeEventListener("pointerdown", onDown);
      r.removeEventListener("pointermove", onMove);
      r.removeEventListener("pointerup", onUp);
      r.removeEventListener("pointercancel", onUp);
      r.removeEventListener("click", swallow, true);
      r.removeEventListener("dragstart", noDrag);
    };
  }, []);

  React.useEffect(() => {
    const r = row.current;
    if (!r) return;
    /* Whether there is a row beyond the edge of the window, so the edge can
       say so: a chip cut in half by the window looks like a mistake, a chip
       fading out looks like a row that continues. */
    const measure = () => {
      r.toggleAttribute("data-more", r.scrollWidth > r.clientWidth + 1);
      const c = lit.current;
      const s = pill.current;
      if (!c || !s) return;
      s.style.width = `${c.offsetWidth}px`;
      s.style.height = `${c.offsetHeight}px`;
      s.style.transform = `translate(${c.offsetLeft}px, ${c.offsetTop}px)`;
      s.style.opacity = "1";
      // Placed, it may move from here on; the first placement just is.
      requestAnimationFrame(() => s.toggleAttribute("data-placed", true));
    };
    if (!pill.current?.hasAttribute("data-placed"))
      pill.current?.style.setProperty("transition", "none");
    measure();
    requestAnimationFrame(() => pill.current?.style.removeProperty("transition"));
    const c = lit.current;
    if (c && r.scrollWidth > r.clientWidth) {
      /* Only when the chosen chip is not already in view. Re-centring a
         chip that is on screen moves the row under the hand for no reason,
         which is half of what made a filter click feel unsettled. */
      const left = c.offsetLeft - r.scrollLeft;
      const hidden = left < 8 || left + c.offsetWidth > r.clientWidth - 8;
      if (hidden) {
        const to = c.offsetLeft - r.clientWidth / 2 + c.offsetWidth / 2;
        r.scrollTo({
          left: Math.max(0, Math.min(r.scrollWidth - r.clientWidth, to)),
          behavior: "smooth",
        });
      }
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [key]);

  return (
    <StripPage
      head={
        <>
          <StripHead
            crumb={
              all ? (
                <span className="label text-muted-foreground">All work</span>
              ) : (
                <Link
                  href="/work"
                  className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                >
                  &larr; All work
                </Link>
              )
            }
            title={head.title}
            live
            aside={head.aside}
            /* On /work the strip opens on a discipline, so the page's own
               title lives here, in the middle of the head, from the first
               frame. A category page still opens on its name set large and
               the head waits for that cell to go. */
            open={all}
          />

          {/* The old site's three dropdowns become one row that can be
              ignored: the default is everything, so nobody has to make a
              choice before they can look at anything. */}
          <div className="mt-3 flex w-full shrink-0 items-center gap-2">
            <nav aria-label="Categories" className="min-w-0 flex-1">
            {/* The padding is the list's, not the bar's: at the bar's edge
                the chips would stop dead against 24px of nothing, and a
                row that scrolls should run to the edge of the window and
                out of it. */}
            <ul
              ref={row}
              className="relative gap-x-0.5 px-3 select-none max-sm:grid max-sm:grid-cols-2 max-sm:justify-items-start max-sm:gap-y-0.5 sm:flex sm:flex-nowrap sm:overflow-x-auto sm:px-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {/* The lit pill is one element that slides to whichever chip
                  is chosen, rather than a fill each chip draws for itself:
                  the choice is seen moving along the row. Measured in the
                  effect above; the first placement is not animated. */}
              <span
                ref={pill}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 rounded-full bg-foreground opacity-0 transition-[transform,width,height] duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-none"
              />
              <li ref={all ? lit : undefined} className="relative z-10">
                <Chip
                  href="/work"
                  active={all}
                  count={heads.all?.count}
                  ring="All work"
                  onPress={(way) => lane("all", way)}
                >
                  All
                </Chip>
              </li>
              {categories.map((c) => (
                <li
                  key={c.slug}
                  ref={key === c.slug ? lit : undefined}
                  className="relative z-10 shrink-0"
                >
                  <Chip
                    href={c.href}
                    active={key === c.slug}
                    count={heads[c.slug]?.count}
                    ring={c.name}
                    onPress={(way) => lane(c.slug, way)}
                  >
                    {c.name}
                  </Chip>
                </li>
              ))}
              </ul>
            </nav>

            {/* Two ways through the same work, named rather than drawn: an
                icon of four squares is a guess, and these are two words. */}
            <div
              className={cn(
                "flex shrink-0 items-center gap-1 pr-6 sm:pr-10 max-sm:hidden",
                !sheet && "hidden",
              )}
            >
              {(["strip", "grid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => chooseView(mode)}
                  className={cn(
                    "label rounded-full px-2.5 py-1.5 transition-colors duration-200 max-sm:py-3",
                    view === mode
                      ? "text-foreground"
                      : "text-muted-foreground/60 hoverable:hover:text-foreground",
                  )}
                >
                  <span className="uppercase">{mode}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      }
    >
      {/* The row, and the lane that passes over it on a filter: `runLane`
          above. The head and the chips are outside it and hold still. */}
      <div ref={rowBox} className="relative flex min-h-0 flex-1 flex-col">
        <StripView value={view}>{children}</StripView>
      </div>
    </StripPage>
  );
}

function Chip({
  href,
  active,
  count,
  ring,
  onPress,
  children,
}: {
  href: string;
  active: boolean;
  /** What the pointer ring says over it. */
  ring: string;
  /** Pressed, with which side of the lit chip it lies on. */
  onPress: (way: 1 | -1) => void;
  /** Shown after the name: the row reads as a map of the archive rather
      than eleven words, and the size of a discipline is the thing an art
      director is weighing when they pick one. */
  count?: number;
  children: React.ReactNode;
}) {
  /* Chips. The chosen filter is filled, ink on ground, which is the one
     mark that can be found at a glance in a row of eleven; the rest
     light up as a soft pill under a pointer. */
  const className = cn(
    /* A thumb's worth of chip on a phone, where the row scrolls and a
       mis-tap is a filter nobody asked for; the desktop keeps the line
       thin, because the pointer is exact and the band is height the
       photographs would rather have. */
    "label block whitespace-nowrap rounded-full px-3 py-1.5 max-sm:py-3",
    "transition-[color,background-color,transform] duration-200 ease-[var(--ease-out-strong)]",
    // A chip lifts a touch under the pointer and gives under the press;
    // the lit one is drawn by the pill sliding beneath the row.
    "hoverable:hover:scale-[1.05] active:scale-[0.96] motion-reduce:hover:scale-100",
    active
      ? "text-background"
      : "text-muted-foreground hoverable:hover:bg-foreground/[0.07] hoverable:hover:text-foreground focus-visible:bg-foreground/[0.07] focus-visible:text-foreground",
  );
  return (
    <Link
      prefetch={false}
      href={href}
      // `page`, not `true`: this is a link to the page being viewed, which
      // is what a screen reader should be told about the current filter.
      aria-current={active ? "page" : undefined}
      // The pointer ring says which filter it is over. Julian asked.
      data-ring={ring}
      /* So the strip that is about to mount knows it is a filter change
         and fades in where it stands, instead of sliding in from a
         quarter of the window away as an arriving page does. */
      onClick={(e) => {
        /* Which side of the lit chip this one lies, measured at the press;
           the strip's own fade keeps no slide of its own now that the row
           passes (below). */
        const me = e.currentTarget.getBoundingClientRect();
        const row = e.currentTarget.closest("ul");
        const lit = row?.querySelector('[aria-current="page"]');
        const from = lit?.getBoundingClientRect().left ?? me.left;
        markFilter(0);
        if (!active) onPress(me.left - from < 0 ? -1 : 1);
      }}
      className={className}
    >
      {children}
      {count === undefined ? null : (
        <span
          className={cn(
            "ml-1 tabular-nums",
            active ? "text-background/60" : "text-muted-foreground/60",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
