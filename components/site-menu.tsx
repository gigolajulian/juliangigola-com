"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LINKS } from "@/components/site-header";

/* ── the drawer ─────────────────────────────────────────────
 * Julian: pressing the burger should push the screen left and bring the
 * menu out from behind it on the right.
 *
 * So the page is the lid. The bar, the page and the footer all travel left
 * by the drawer’s width while the drawer travels in by the same width over
 * the same time, which keeps its left edge against the page’s right edge
 * for every frame of the journey: nothing is uncovered that was not
 * already there, and the two read as one object being slid aside.
 *
 * It lives beside the header rather than inside it because the header is
 * one of the things that moves, and a fixed panel inside a moving element
 * is measured from the element instead of from the window.
 *
 * Open and closed are `data-menu` on `<html>`, written by the header — see
 * `.site-menu` in `globals.css`. There is no state in here at all, which is
 * what lets the drawer render on the server with its links in the page for
 * anything that reads it without running the script.
 * ───────────────────────────────────────────── */

export function SiteMenu() {
  const pathname = usePathname();
  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      id="mobile-nav"
      /* The whole window, so a press on the page that has been pushed
         aside puts it back — which is what a page held open at arm’s
         length is asking for. Closed it is `visibility: hidden`, which
         takes the links out of the tab order and out of a screen reader
         with them, so this covers nothing until it is open. */
      onClick={(e) => {
        if (e.target === e.currentTarget)
          window.dispatchEvent(new Event("jg:menu-close"));
      }}
      className="site-menu fixed inset-0 z-30 lg:hidden"
    >
      <div className="site-menu-panel ml-auto flex h-full w-[var(--menu-w)] flex-col justify-center border-l border-border pl-6 pr-7">
        <nav aria-label="Menu">
          <ul className="flex flex-col items-end gap-1 text-right">
            {LINKS.map((link, i) => (
              <li
                key={link.href}
                // Staggered so the list arrives from behind the page rather
                // than landing with it. Short delays only: 40ms a step reads
                // as one gesture, 150ms reads as waiting. On the way out
                // there is no delay, so closing is a single movement.
                style={
                  { "--reveal-delay": `${i * 40}ms` } as React.CSSProperties
                }
                className="site-menu-item relative"
              >
                {/* The current page is marked, rather than the others being
                    dimmed. The accent is the only saturated colour on the
                    site and already means “you are here”. */}
                {isCurrent(link.href) ? (
                  <span
                    aria-hidden
                    className="absolute -right-4 top-1/2 h-8 w-1 -translate-y-1/2 bg-accent"
                  />
                ) : null}
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  className={cn(
                    // Sized to the drawer rather than to the window: the
                    // longest of the four has to sit on one line inside it.
                    "font-display block py-2 uppercase leading-[0.95] tracking-[0]",
                    "text-[clamp(2.75rem,12vw,3.5rem)]",
                    // Full strength, always. Dimming everything-but-current
                    // greys out the whole menu on any page that is not one of
                    // these four, the homepage included, which reads as
                    // disabled rather than as emphasis.
                    "hoverable:hover:opacity-70",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
