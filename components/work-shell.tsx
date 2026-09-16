"use client";

import * as React from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";
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

export function WorkShell({
  heads,
  categories,
  children,
}: {
  /** By filter key: "all", a category slug, or "video". */
  heads: Record<string, Head>;
  categories: CategoryLink[];
  children: React.ReactNode;
}) {
  const segments = useSelectedLayoutSegments();
  // [] on /work, ["category", slug] on a discipline, ["video"] on the films.
  const key = segments[1] ?? segments[0] ?? "all";
  const head = heads[key] ?? heads.all;
  const all = key === "all";

  /* The row is one line that scrolls, so eleven chips cost 25px at any
     width instead of wrapping to four rows and 113px on a phone - which
     was 15% of the screen spent on the filter, above the work it filters.
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
  React.useEffect(() => {
    const r = row.current;
    if (!r) return;
    /* Whether there is a row beyond the edge of the window, so the edge can
       say so: a chip cut in half by the window looks like a mistake, a chip
       fading out looks like a row that continues. */
    const measure = () => r.toggleAttribute("data-more", r.scrollWidth > r.clientWidth + 1);
    measure();
    const c = lit.current;
    if (c && r.scrollWidth > r.clientWidth) {
      const to = c.offsetLeft - r.clientWidth / 2 + c.offsetWidth / 2;
      r.scrollLeft = Math.max(0, Math.min(r.scrollWidth - r.clientWidth, to));
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
              className="flex flex-nowrap gap-x-0.5 overflow-x-auto px-3 [scrollbar-width:none] sm:px-7 [&::-webkit-scrollbar]:hidden"
            >
              <li ref={all ? lit : undefined}>
                <Chip href="/work" active={all} count={heads.all?.count}>
                  All
                </Chip>
              </li>
              {categories.map((c) => (
                <li
                  key={c.slug}
                  ref={key === c.slug ? lit : undefined}
                  className="shrink-0"
                >
                  <Chip
                    href={c.href}
                    active={key === c.slug}
                    count={heads[c.slug]?.count}
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
                "flex shrink-0 items-center gap-1 pr-6 sm:pr-10",
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
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </>
      }
    >
      <StripView value={view}>{children}</StripView>
    </StripPage>
  );
}

function Chip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
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
    "transition-colors duration-200 ease-[var(--ease-out-strong)]",
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hoverable:hover:bg-foreground/[0.07] hoverable:hover:text-foreground focus-visible:bg-foreground/[0.07] focus-visible:text-foreground",
  );
  return (
    <Link
      prefetch={false}
      href={href}
      // `page`, not `true`: this is a link to the page being viewed, which
      // is what a screen reader should be told about the current filter.
      aria-current={active ? "page" : undefined}
      /* So the strip that is about to mount knows it is a filter change
         and fades in where it stands, instead of sliding in from a
         quarter of the window away as an arriving page does. */
      onClick={markFilter}
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
