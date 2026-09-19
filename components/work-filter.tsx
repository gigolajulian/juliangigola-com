"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryLink } from "@/lib/work";
import type { Head } from "@/lib/work-heads";

/* ── the filters, as a drawer ─────────────────────────────────────
 * Julian: the filters should do exactly what the menu does, from the
 * other side. So this is `site-menu.tsx` mirrored — the page is pushed
 * right, the twelve disciplines come out from behind it on the left, and
 * every rule about how that looks and how long it takes is shared
 * (`.drawer` in `globals.css`).
 *
 * It is here rather than in the work route's own shell because the shell
 * lives inside `main`, and `main` is one of the things the drawer slides
 * out from under: a fixed panel inside a moving element is measured from
 * the element instead of from the window. The capsule that opens it stays
 * in the bar where it belongs and says so through `data-drawer` on
 * `<html>` — see `work-shell.tsx`.
 *
 * No state in here at all, which is what lets it render on the server
 * with its links in the page.
 * ─────────────────────────────────────────────────────────────── */

export function WorkFilter({
  categories,
  heads,
}: {
  categories: CategoryLink[];
  heads: Record<string, Head>;
}) {
  const pathname = usePathname();

  // Every page in the site mounts the root layout, and eleven of them have
  // nothing to filter. The work index, its disciplines and the video page
  // are the three shapes of route that do.
  if (!pathname.startsWith("/work")) return null;

  const rows = [
    { slug: "all", name: "All work", href: "/work" },
    ...categories,
  ];
  const isCurrent = (href: string) =>
    href === "/work" ? pathname === "/work" : pathname.startsWith(href);

  return (
    <div
      id="work-filter"
      /* The whole window, so a press on the page that has been pushed
         aside puts it back. Closed it is `visibility: hidden`, which takes
         the links out of the tab order and out of a screen reader with
         them, so this covers nothing until it is open. */
      onClick={(e) => {
        if (e.target === e.currentTarget)
          window.dispatchEvent(new Event("jg:filter-close"));
      }}
      className="drawer work-filter fixed inset-0 z-30 lg:hidden"
    >
      <div className="work-filter-panel drawer-panel flex h-full w-[var(--filter-w)] flex-col justify-center border-r border-border pl-6 pr-5">
        <nav aria-label="Disciplines">
          <ul className="flex flex-col">
            {rows.map((row, i) => {
              const head = heads[row.slug];
              const here = isCurrent(row.href);
              return (
                <li
                  key={row.slug}
                  // Thirty a step, not the menu's sixty: four names a step
                  // apart is a cascade, twelve would be most of a second
                  // of somebody waiting to read the last one.
                  style={
                    { "--reveal-delay": `${i * 30}ms` } as React.CSSProperties
                  }
                  className="work-filter-item drawer-item"
                >
                  <Link
                    href={row.href}
                    prefetch={false}
                    // The door starts shutting on the press, not when the new
                    // route commits. Measured: the route landed 300ms after the
                    // tap, so the drawer was still travelling its last 33px when
                    // the incoming page began to rise into it.
                    onClick={() => window.dispatchEvent(new Event("jg:filter-close"))}
                    aria-current={here ? "page" : undefined}
                    className={cn(
                      "flex items-baseline justify-between gap-4 py-1.5",
                      "transition-opacity duration-200 ease-[var(--ease-out-strong)]",
                      here ? "opacity-100" : "opacity-45 hoverable:hover:opacity-70",
                    )}
                  >
                    <span className="font-display uppercase leading-[0.95] tracking-[0] text-[clamp(1.375rem,4.5vw,1.75rem)]">
                      {row.name}
                    </span>
                    {/* The count in the ink of the name beside it, not in
                        the muted grey: over a dark frame the grey was the
                        one thing on the panel that did not survive. */}
                    <span className="label shrink-0 tabular-nums opacity-60">
                      {head?.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
