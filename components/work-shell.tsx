"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";
import { VideoHero } from "@/components/video-hero";
import { REEL } from "@/lib/videos";

/* ── the frame around the work ────────────────────────────────────
 * The head and the chip row, mounted once for the whole of /work, its
 * category pages and the video page — the route group `(index)` puts
 * them under one layout, and this is that layout's client half.
 *
 * Julian: "when switching through filters don't reload everything, just
 * change the ones needed". Each filter is still its own route, so it can
 * be linked and indexed, but the routes used to draw their own head and
 * chips: every click remounted the title, the count and eleven chips,
 * and all of it rose in again. Now the layout persists across the
 * navigation and only the words change; what the page renders under the
 * chips is what leaves and arrives.
 *
 * Which filter is showing is read from the route, not passed down: a
 * layout does not see its children's params, but a client component in
 * it can read the selected segments, and `heads` carries the title and
 * the line under it for every filter the layout could be showing.
 * ─────────────────────────────────────────────────────────────── */

export type Head = { title: string; sub: string };

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
  /* On the video filter the reel plays behind all of this, so the head
     goes white and the chips take their colours from the film rather
     than the page. Julian asked for the reel in the background, muted. */
  const film = key === "video";

  return (
    <>
      {/* Pinned from `lg`: the head and the chips stay at the top of the
          screen while the list under them scrolls with the page, so the
          page is the only thing that scrolls. Julian found two scrolls (the
          list in its own box, then the page) confusing. Not over the film,
          which is most of a screen tall. */}
      <div
        className={cn(
          "relative",
          !film && "bg-background lg:sticky lg:top-0 lg:z-30",
        )}
      >
        {film ? (
          <VideoHero
            videoId={REEL.videoId}
            title={REEL.title}
            year={REEL.year}
          />
        ) : null}

        <div
          className={cn(
            "relative z-10 mx-auto w-full max-w-[100rem] px-6 pt-24 sm:px-10 sm:pt-28",
            /* Taller over the film, Julian asked: most of a screen of reel,
               with the head and the chips at its foot. The other filters
               keep the head's natural height. */
            film && "flex min-h-[78dvh] flex-col justify-end pb-4",
          )}
        >
          <header className="rise">
            {/* The crumb, or the same-height slot where it would be, so the
                title sits at one height on every filter. */}
            <div>
              {key === "all" ? (
                <span className="label text-muted-foreground">All work</span>
              ) : (
                <Link
                  href="/work"
                  className={cn(
                    "label transition-colors duration-200",
                    film
                      ? "text-white/70 hoverable:hover:text-white"
                      : "text-muted-foreground hoverable:hover:text-foreground",
                  )}
                >
                  &larr; All work
                </Link>
              )}
            </div>
            <h1
              className={cn(
                "mt-5 title transition-colors duration-200",
                film && "text-white",
              )}
            >
              {head.title}
            </h1>
            <p
              className={cn(
                "mt-3 max-w-prose text-sm leading-relaxed transition-colors duration-200",
                film ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {head.sub}
            </p>
          </header>

          {/* The old site's three dropdowns become one row that can be
              ignored: the default is everything, so nobody has to make a
              choice before they can look at anything. */}
          <nav
            aria-label="Categories"
            className={cn(
              "mt-6 border-b pb-4 transition-colors duration-200",
              film ? "border-white/20" : "border-border",
            )}
          >
            <ul className="-mx-3 flex flex-wrap gap-x-1 gap-y-2">
              <li>
                <FilterLink href="/work" active={key === "all"} film={film}>
                  All
                </FilterLink>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <FilterLink href={c.href} active={key === c.slug} film={film}>
                    {c.name}
                  </FilterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Out, then in. Keyed on the filter so React sees one page leave and
          another arrive, and the boundary names the two halves for
          `globals.css`: the old list drops away in 160ms, the new one rises
          in after it. `default="none"` so nothing else animates on the way. */}
      <ViewTransition enter="work-in" exit="work-out" default="none">
        <div key={key}>{children}</div>
      </ViewTransition>
    </>
  );
}

function FilterLink({
  href,
  active,
  film,
  children,
}: {
  href: string;
  active: boolean;
  /** Over the reel: white on the film instead of ink on the page. */
  film: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      // `page`, not `true`: this is a link to the page being viewed, which
      // is what a screen reader should be told about the current filter.
      aria-current={active ? "page" : undefined}
      /* Chips. The chosen filter is filled, ink on ground, which is the one
         mark that can be found at a glance in a row of eleven; the rest
         light up as a soft pill under a pointer. */
      className={cn(
        "label block rounded-full px-3 py-1.5",
        "transition-colors duration-200 ease-[var(--ease-out-strong)]",
        film
          ? active
            ? "bg-white text-black"
            : "text-white/70 hoverable:hover:bg-white/10 hoverable:hover:text-white focus-visible:bg-white/10 focus-visible:text-white"
          : active
            ? "bg-foreground text-background"
            : "text-muted-foreground hoverable:hover:bg-foreground/[0.07] hoverable:hover:text-foreground focus-visible:bg-foreground/[0.07] focus-visible:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
