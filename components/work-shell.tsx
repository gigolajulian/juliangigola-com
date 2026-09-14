"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";

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

  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pt-28 sm:px-10 sm:pt-36">
        <header className="rise">
          {/* The crumb, or the same-height slot where it would be, so the
              title sits at one height on every filter. */}
          <div>
            {key === "all" ? (
              <span className="label text-muted-foreground">All work</span>
            ) : (
              <Link
                href="/work"
                className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
              >
                &larr; All work
              </Link>
            )}
          </div>
          <h1 className="mt-8 title">{head.title}</h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {head.sub}
          </p>
        </header>

        {/* The old site's three dropdowns become one row that can be
            ignored: the default is everything, so nobody has to make a
            choice before they can look at anything. */}
        <nav
          aria-label="Categories"
          className="mt-10 border-b border-border pb-5"
        >
          <ul className="-mx-3 flex flex-wrap gap-x-1 gap-y-2">
            <li>
              <FilterLink href="/work" active={key === "all"}>
                All
              </FilterLink>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <FilterLink href={c.href} active={key === c.slug}>
                  {c.name}
                </FilterLink>
              </li>
            ))}
          </ul>
        </nav>
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
  children,
}: {
  href: string;
  active: boolean;
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
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hoverable:hover:bg-foreground/[0.07] hoverable:hover:text-foreground focus-visible:bg-foreground/[0.07] focus-visible:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
