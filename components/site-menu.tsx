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
 * Open and closed are `data-drawer` on `<html>`, written by the header —
 * see `.drawer` in `globals.css`, which this shares with the filters on
 * the other side. There is no state in here at all, which is what lets the
 * drawer render on the server with its links in the page for anything that
 * reads it without running the script.
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
      className="drawer site-menu fixed inset-0 z-30 lg:hidden"
    >
      <div className="site-menu-panel drawer-panel ml-auto flex h-full w-[var(--menu-w)] flex-col justify-center border-l border-border pl-6 pr-7">
        <nav aria-label="Menu">
          <ul className="flex flex-col items-end gap-1 text-right">
            {LINKS.map((link, i) => (
              <li
                key={link.href}
                // Staggered so the list arrives from behind the page rather
                // than landing with it, and top down: 60ms a step, which is
                // enough to be read as an order while still being one
                // gesture. It was 40 and the cascade was inside the drawer’s
                // own movement rather than beside it. On the way out there is
                // no delay at all, so closing is a single movement.
                style={
                  { "--reveal-delay": `${i * 60}ms` } as React.CSSProperties
                }
                className="site-menu-item drawer-item"
              >
                <Link
                  href={link.href}
                  // The door starts shutting on the press, not when the new
                  // route commits. Measured: the route landed 300ms after the
                  // tap, so the drawer was still travelling its last 33px when
                  // the incoming page began to rise into it.
                  onClick={() => window.dispatchEvent(new Event("jg:menu-close"))}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  className={cn(
                    // Sized to the drawer rather than to the window: the
                    // longest of the four has to sit on one line inside it.
                    "font-display block py-2 uppercase leading-[0.95] tracking-[0]",
                    "text-[clamp(2.75rem,12vw,3.5rem)]",
                    // Where you are is the one at full strength and the rest
                    // stand back, at Julian's ask. It was an accent bar in the
                    // margin beside the current page; the ink says the same
                    // thing without putting a second mark on the screen, and
                    // it gives the pointer somewhere to go — half way up on
                    // hover, which is an answer rather than an arrival.
                    //
                    // On a page that is none of these four, the homepage
                    // included, all four sit back. That is honest: none of
                    // them is where you are.
                    "transition-opacity duration-200 ease-[var(--ease-out-strong)]",
                    isCurrent(link.href)
                      ? "opacity-100"
                      : "opacity-45 hoverable:hover:opacity-70",
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
