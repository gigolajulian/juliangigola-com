"use client";

import * as React from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";
import { StripPage, StripHead } from "@/components/strip-page";

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
 * On /work itself the chips do not navigate at all: the whole of the work
 * is one strip, discipline by discipline, and a chip glides to its
 * discipline's opening cell. A plain anchor, not a `Link`: a same-path
 * hash through the router never fires `hashchange`, and the strip listens
 * for exactly that. On a category page the chips are routes again.
 * ─────────────────────────────────────────────────────────────── */

export type Head = { title: string; aside: string };

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
          <nav
            aria-label="Categories"
            className="mx-auto mt-3 w-full max-w-[100rem] shrink-0 px-6 sm:px-10"
          >
            <ul className="-mx-3 flex flex-wrap gap-x-1 gap-y-1">
              <li>
                <Chip href={all ? "#work" : "/work"} jump={all} active={all}>
                  All
                </Chip>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Chip
                    href={all ? `#${c.slug}` : c.href}
                    jump={all}
                    active={key === c.slug}
                  >
                    {c.name}
                  </Chip>
                </li>
              ))}
            </ul>
          </nav>
        </>
      }
    >
      {children}
    </StripPage>
  );
}

function Chip({
  href,
  jump,
  active,
  children,
}: {
  href: string;
  /** A jump within the strip rather than a route. */
  jump: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  /* Chips. The chosen filter is filled, ink on ground, which is the one
     mark that can be found at a glance in a row of eleven; the rest
     light up as a soft pill under a pointer. */
  const className = cn(
    "label block rounded-full px-3 py-1.5",
    "transition-colors duration-200 ease-[var(--ease-out-strong)]",
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hoverable:hover:bg-foreground/[0.07] hoverable:hover:text-foreground focus-visible:bg-foreground/[0.07] focus-visible:text-foreground",
  );
  if (jump) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link
      prefetch={false}
      href={href}
      // `page`, not `true`: this is a link to the page being viewed, which
      // is what a screen reader should be told about the current filter.
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
