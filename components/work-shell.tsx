"use client";

import * as React from "react";
import loader from "../image-loader";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";
import type { Head } from "@/lib/work-heads";
import { StripPage, StripHead } from "@/components/strip-page";
import { markFilter, StripView, type StripViewMode } from "@/components/strip";

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

export type { Head };

/** One picture a filter's row opens on: a cover, a frame or a poster. */
export type PassPic = {
  src: string;
  width: number;
  height: number;
  color: string;
};

/* The row is faded and not carried.
 *
 * A chip used to build a lane: clones of the cells on screen sliding off,
 * a picture from every filter between the two passing after them, and the
 * new row following the last of them in. Recorded at 60fps it filled the
 * window with photographs at a size they are seen nowhere else on the
 * site, swung the screen 44% darker than either page and took a second to
 * do it. Julian: fix it or disable it. The strip's own fade is what a
 * filter is now - 260ms, a 5vw slide from the side the pressed chip lies
 * on, and the row it names. `jg-fade-slide` in `globals.css`.
 */

const RUNGS = [128, 256, 640, 1080, 1280, 1920, 2500];
const rowSrc = (p: PassPic) => {
  const dpr = window.devicePixelRatio || 1;
  const css =
    (window.innerHeight - 160) *
    (p.width / p.height) *
    (dpr >= 2.5 ? 0.667 : 1);
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
  /** By the same key: the pictures each filter's row opens on. */
  passes: Record<string, PassPic[]>;
  children: React.ReactNode;
}) {
  const rowBox = React.useRef<HTMLDivElement>(null);
  /* The warm-up: on a desktop with a pointer and no request to save data,
     once the page is idle, the two covers each filter's row opens on are
     fetched and decoded, so a filter pressed later has its first screen
     already. Covers only, and only the two that will be seen. A phone is
     left alone. */
  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    const conn = (navigator as { connection?: { saveData?: boolean } })
      .connection;
    if (conn?.saveData) return;
    const warm = () => {
      for (const pics of Object.values(passes)) {
        for (const p of pics.slice(0, 2)) new Image().src = rowSrc(p);
      }
    };
    const idle = (
      window as {
        requestIdleCallback?: (
          cb: () => void,
          o?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    const handle = idle
      ? idle(warm, { timeout: 4000 })
      : window.setTimeout(warm, 1500);
    return () => {
      const cancel = (window as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback;
      if (idle && cancel) cancel(handle);
      else window.clearTimeout(handle);
    };
  }, [passes]);

  const segments = useSelectedLayoutSegments();
  // [] on /work, ["category", slug] on a discipline, ["video"] on the films.
  const key = segments[1] ?? segments[0] ?? "all";
  const head = heads[key] ?? heads.all;
  const all = key === "all";

  /* ── the capsule, below `lg` ──
     The twelve disciplines are a drawer there rather than a bar
     (`work-filter.tsx`), so what is left in the row is one control saying
     where you are. The drawer itself is mounted in the root layout,
     because it is `main` that slides out from under it, so being open is
     `data-drawer` on `<html>` and the stylesheet does the rest — the same
     attribute, and the same rules, as the menu on the other side.

     Opening this one closes that one: one attribute holds one name, and
     without the message the menu's own state would drift out of step with
     what is on the screen. */
  const [filtering, setFiltering] = React.useState(false);

  React.useEffect(() => {
    if (!filtering) return;
    const root = document.documentElement;
    root.dataset.drawer = "filter";
    window.dispatchEvent(new Event("jg:menu-close"));
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      if (root.dataset.drawer === "filter") delete root.dataset.drawer;
      document.body.style.overflow = overflow;
    };
  }, [filtering]);

  React.useEffect(() => {
    const close = () => setFiltering(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFiltering(false);
    window.addEventListener("jg:filter-close", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("jg:filter-close", close);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  // A filter pressed inside the drawer is a navigation, and the shell
  // survives it, so the drawer would otherwise stay open over the work it
  // was asked for.
  const [routeWhenOpened, setRouteWhenOpened] = React.useState(key);
  if (routeWhenOpened !== key) {
    setRouteWhenOpened(key);
    setFiltering(false);
  }

  /* Julian: on All, light the discipline you have scrolled to. The strip
     already works out which chapter the middle of the window is in — it
     writes the word on the scroller as `data-at` for the running head and
     the address bar — so the row only has to watch that attribute and
     move its pill. The route does not change and neither does
     `aria-current`: this is where you are in the page, not which page you
     are on. */
  const [here, setHere] = React.useState<string | null>(null);
  React.useEffect(() => {
    // Off All the row follows the route and this is not read at all.
    if (!all) return;
    const el = document.querySelector(".strip-scroll");
    if (!el) return;
    const read = () => {
      const word = (el as HTMLElement).dataset.at ?? "";
      const found = categories.find(
        (c) => c.name.toLowerCase() === word.toLowerCase(),
      );
      setHere(found?.slug ?? null);
    };
    /* A frame late, not in the effect's body: the strip writes `data-at`
       from its own first read, and a state change inside an effect is a
       second render of the row before the browser has painted the first. */
    const first = requestAnimationFrame(read);
    const watch = new MutationObserver(read);
    watch.observe(el, { attributes: true, attributeFilter: ["data-at"] });
    return () => {
      cancelAnimationFrame(first);
      watch.disconnect();
    };
  }, [all, categories, key]);
  /** Which chip is filled: where the strip is, when it says, else the
      route. */
  const shown = all ? here : key;

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
  /* Julian: the choice is offered on every filter, the films and the
     galleries included. It is kept as you walk: from Editorial's grid
     through Places and back, Editorial is still a grid. */
  const view: StripViewMode = chosen;

  const row = React.useRef<HTMLUListElement>(null);
  const lit = React.useRef<HTMLLIElement>(null);
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
    };
    measure();
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
  }, [key, shown]);

  /* Two ways through the same work. Drawn rather than named, and under
     the count rather than out at the edge of the window: the head is the
     page saying what it is and how much of it there is, and how it is
     laid out belongs in the same breath. The word stays as the button's
     label for anyone not looking at the screen. */
  const toggle = (
    <span className="mt-2 flex items-center justify-end gap-1 max-sm:hidden">
      {(["strip", "grid"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={view === mode}
          aria-label={mode === "strip" ? "Strip view" : "Grid view"}
          onClick={() => chooseView(mode)}
          className={cn(
            "-my-1 p-1.5 transition-opacity duration-200",
            view === mode
              ? "text-foreground opacity-100"
              : "text-foreground opacity-35 hoverable:hover:opacity-70",
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="currentColor"
          >
            {mode === "strip" ? (
              <>
                <rect x="0" y="2" width="4" height="12" rx="0.5" />
                <rect x="6" y="2" width="4" height="12" rx="0.5" />
                <rect x="12" y="2" width="4" height="12" rx="0.5" />
              </>
            ) : (
              <>
                <rect x="1" y="1" width="6" height="6" rx="0.5" />
                <rect x="9" y="1" width="6" height="6" rx="0.5" />
                <rect x="1" y="9" width="6" height="6" rx="0.5" />
                <rect x="9" y="9" width="6" height="6" rx="0.5" />
              </>
            )}
          </svg>
        </button>
      ))}
    </span>
  );

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
            aside={
              <>
                {head.aside}
                {toggle}
              </>
            }
            /* On /work the strip opens on a discipline, so the page's own
               title lives here, in the middle of the head, from the first
               frame. A category page still opens on its name set large and
               the head waits for that cell to go. */
            open={all}
          />

          {/* The old site's three dropdowns become one row that can be
              ignored: the default is everything, so nobody has to make a
              choice before they can look at anything. */}
          <div className="mt-3 flex w-full shrink-0 items-center gap-2 tablet:mt-1.5 max-sm:mt-1.5 short:mt-1.5 lying:mt-1.5">
            {/* Where you are, and the way to the other eleven. Gone from
                `lg` up, where the row itself is the control and this would
                be a second one saying the same thing. */}
            <button
              type="button"
              aria-expanded={filtering}
              aria-controls="work-filter"
              onClick={() => setFiltering((v) => !v)}
              className="filter-capsule glass press relative z-10 inline-flex items-center gap-2 rounded-full lg:hidden border border-foreground/20 py-2 pl-3.5 pr-3 label active:scale-[0.97]"
            >
              <span className="text-foreground">
                {all ? "All work" : head.title}
              </span>
              <span
                aria-hidden
                className="h-3 w-px bg-foreground/25"
              />
              <span className="tabular-nums text-muted-foreground">
                {head.count}
              </span>
              <svg
                aria-hidden
                width="9"
                height="6"
                viewBox="0 0 9 6"
                className={cn(
                  "text-muted-foreground transition-transform duration-300 ease-[var(--ease-out-strong)]",
                  filtering && "rotate-180",
                )}
              >
                <path
                  d="M1 1l3.5 3.5L8 1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>

            <nav aria-label="Categories" className="min-w-0 flex-1">
              {/* The padding is the list's, not the bar's: at the bar's edge
                the chips would stop dead against 24px of nothing, and a
                row that scrolls should run to the edge of the window and
                out of it. */}
              <ul
                ref={row}
                /* Centred in the window, by auto margins on the first and
                   last chip rather than `justify-center`: centring a flex
                   row that scrolls puts its start out of reach, and these
                   collapse to nothing the moment the row is wider than the
                   bar.

                   Except where it does not scroll. On an upright tablet the
                   twelve chips are 1470 wide in a 768 window and half of
                   them were off the end of it; `chip-row` in `globals.css`
                   wraps them onto two lines there, where the auto margins
                   are wrong and plain centring is right. */
                className="chip-row relative gap-x-0.5 px-3 select-none max-sm:grid max-sm:grid-cols-2 max-sm:justify-items-start max-sm:gap-y-0.5 sm:flex sm:flex-nowrap sm:overflow-x-auto sm:px-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:[&>li:first-of-type]:ml-auto sm:[&>li:last-of-type]:mr-auto"
              >
                <li
                  ref={all && shown === null ? lit : undefined}
                  className="relative z-10"
                >
                  <Chip
                    href="/work"
                    active={all && shown === null}
                    current={all}
                    count={heads.all?.count}
                  >
                    All
                  </Chip>
                </li>
                {categories.map((c) => (
                  <li
                    key={c.slug}
                    ref={shown === c.slug ? lit : undefined}
                    className="relative z-10 shrink-0"
                  >
                    <Chip
                      href={c.href}
                      active={shown === c.slug}
                      current={key === c.slug}
                      count={heads[c.slug]?.count}
                    >
                      {c.name}
                    </Chip>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </>
      }
    >
      {/* The row. The head and the chips are outside it and hold still. */}
      <div ref={rowBox} className="relative flex min-h-0 flex-1 flex-col">
        <StripView value={view}>{children}</StripView>
      </div>
    </StripPage>
  );
}

function Chip({
  href,
  active,
  current = active,
  count,
  children,
}: {
  href: string;
  /** Filled: the filter showing, or on All the chapter being scrolled
      through. A look, not an address. */
  active: boolean;
  /** The page this chip leads to is the page being shown. The address,
      which a screen reader is told about and the row's own presses read;
      it defaults to `active` for every row that has no second idea of
      where it is. */
  current?: boolean;
  /** Shown after the name: the row reads as a map of the archive rather
      than eleven words, and the size of a discipline is the thing an art
      director is weighing when they pick one. */
  count?: number;
  children: React.ReactNode;
}) {
  /* Chips. The chosen filter is set bold and in full ink, and that is the
     mark that can be found at a glance in a row of eleven; the rest
     only brighten under a pointer. The soft pill that used to draw
     itself under the hand is gone: the lit marker already says which
     one is chosen, and a second fill saying nothing was redundant.
     Julian asked. The keyboard keeps its fill, because a focus ring
     that is only a colour change is not a focus ring. */
  const className = cn(
    /* A thumb's worth of chip on a phone, where the row scrolls and a
       mis-tap is a filter nobody asked for; the desktop keeps the line
       thin, because the pointer is exact and the band is height the
       photographs would rather have. */
    "label block whitespace-nowrap px-3 py-1.5 max-sm:py-3",
    "transition-[color,background-color,transform] duration-200 ease-[var(--ease-out-strong)]",
    // A chip lifts a touch under the pointer and gives under the press.
    "hoverable:hover:scale-[1.05] active:scale-[0.96] motion-reduce:hover:scale-100",
    active
      ? "font-bold text-foreground"
      : "text-muted-foreground hoverable:hover:text-foreground focus-visible:bg-foreground/[0.07] focus-visible:text-foreground",
  );
  return (
    <Link
      prefetch={false}
      href={href}
      // `page`, not `true`: this is a link to the page being viewed, which
      // is what a screen reader should be told about the current filter.
      aria-current={current ? "page" : undefined}
      /* No word at the pointer. The chip it is over is already a word,
         and the pointer was repeating it back a few pixels lower down.
         Julian asked. */
      data-ring=""
      /* So the strip that is about to mount knows it is a filter change
         and fades in where it stands, instead of sliding in from a
         quarter of the window away as an arriving page does. */
      onClick={(e) => {
        /* Which side of the lit chip this one lies, measured at the press:
           the row fades in from that side, so pressing a filter to the
           right of the lit one brings its covers in from the right. A
           press on the chip already lit passes nought and the row fades
           where it stands. */
        const me = e.currentTarget.getBoundingClientRect();
        const row = e.currentTarget.closest("ul");
        const lit = row?.querySelector('[aria-current="page"]');
        const from = lit?.getBoundingClientRect().left ?? me.left;
        markFilter(current ? 0 : me.left - from < 0 ? -1 : 1);
        /* Julian: pressing All while the work is already showing all of
           it goes back to the beginning. A link to the page you are on
           changes no route and moves nothing otherwise; `jg:home` is the
           same event the wordmark sends on the homepage, so the strip
           travels there under its own friction rather than cutting. */
        if (current)
          document
            .querySelector(".strip-scroll")
            ?.dispatchEvent(new Event("jg:home"));
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
