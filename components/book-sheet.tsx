"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { BookCard } from "@/components/book-here";
import { InquireWall } from "@/components/inquire-wall";
import type { WallTile } from "@/lib/wall-tile";
import type { MenuItem } from "@/lib/booking";

/* ── the booking sheet ─────────────────────────────────────────────
 * Julian, 2026-10-14: a session pressed, its card grows out of the row,
 * fills the screen over the session's wall, and goes back into the row
 * on X, Escape or a press outside it. The page under it never moves.
 *
 * The card is laid out at its full size from the first frame and only
 * its clip opens, from the row's box to its own: transform-free, so the
 * card's contents never stretch, and nothing is laid out twice. Leaving
 * runs at about 60% of arriving (exit faster than enter).
 * ─────────────────────────────────────────────────────────────────── */

const IN = 520;
const OUT = 320;
const EASE_IN = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_OUT = "cubic-bezier(0.4, 0, 0.9, 0.6)";

const inset = (from: DOMRect, to: DOMRect, r: number) =>
  `inset(${from.top - to.top}px ${to.right - from.right}px ${to.bottom - from.bottom}px ${from.left - to.left}px round ${r}px)`;

export function BookSheet({
  item,
  origin,
  wall,
  onClosed,
}: {
  item: MenuItem;
  /* The row pressed: where the card comes from and goes back to. */
  origin: HTMLElement | null;
  wall?: WallTile[];
  onClosed: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const sheet = React.useRef<HTMLDivElement>(null);
  const back = React.useRef<HTMLDivElement>(null);
  const body = React.useRef<HTMLDivElement>(null);
  const going = React.useRef(false);
  const calm = React.useRef(false);
  // A press on the wall closes, once the sheet has opened: not the
  // second half of a double tap on the row.
  const ready = React.useRef(0);

  /* No wall on a phone (Julian's recording, 2026-10-14: Safari reloaded
     the page as a sheet opened, twice, after the third). A screen of
     photographs under a full-screen blur, on top of the homepage's own
     walls, is more than an iPhone tab keeps; the ground is solid there. */
  const [phone, setPhone] = React.useState(true);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhone(matchMedia("(max-width: 39.99rem)").matches);
    setMounted(true);
  }, []);

  // The page holds still under the sheet.
  React.useEffect(() => {
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = was;
    };
  }, []);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    calm.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    ready.current = performance.now() + (calm.current ? 0 : IN);
    document.getElementById("book-card")?.focus({ preventScroll: true });
    const s = sheet.current;
    if (calm.current || !s || !origin) return;
    const from = origin.getBoundingClientRect();
    const to = s.getBoundingClientRect();
    s.animate([{ clipPath: inset(from, to, 4) }, { clipPath: inset(to, to, 16) }], { duration: IN, easing: EASE_IN });
    body.current?.animate([{ opacity: 0, transform: "translateY(0.75rem)" }, { opacity: 1, transform: "none" }], {
      duration: 360,
      delay: 160,
      easing: EASE_IN,
      fill: "backwards",
    });
    back.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN, easing: "ease-out" });
  }, [mounted, origin]);

  const close = React.useCallback(() => {
    if (going.current) return;
    going.current = true;
    const done = () => {
      onClosed();
      origin?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
    };
    const s = sheet.current;
    if (calm.current || !s || !origin) return done();
    const to = s.getBoundingClientRect();
    const from = origin.getBoundingClientRect();
    body.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT * 0.5, easing: "ease-in", fill: "forwards" });
    back.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, easing: "ease-in", fill: "forwards" });
    s.animate([{ clipPath: inset(to, to, 16) }, { clipPath: inset(from, to, 4) }], {
      duration: OUT,
      easing: EASE_OUT,
      fill: "forwards",
    }).finished.then(done, done);
  }, [onClosed, origin]);

  React.useEffect(() => {
    // Not from inside a field: Escape there threw away a half-typed form.
    const key = (e: KeyboardEvent) => e.key === "Escape" && !(e.target as Element).closest?.("input, textarea, select") && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);

  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Book ${item.name}`}
      data-scroll=""
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[90] flex items-center justify-center overscroll-contain sm:p-[clamp(1rem,4vh,3rem)]"
    >
      {/* The session's wall, and a press on it closes the sheet. */}
      <div ref={back} className="absolute inset-0">
        {/* Inert: its tiles are links, and a press meant to close the
            sheet went to a project. */}
        <div inert className="enquiry-backdrop questions-wall absolute inset-0 overflow-hidden bg-background">
          {wall?.length && !phone ? <InquireWall items={wall} /> : null}
        </div>
        <div aria-hidden onClick={() => performance.now() >= ready.current && close()} className="absolute inset-0" />
      </div>
      <div
        ref={sheet}
        className="relative flex h-dvh w-full flex-col will-change-[clip-path] max-sm:bg-background sm:h-[min(46rem,100%)] sm:w-[min(46rem,100%)]"
      >
        {/* On a phone the sheet scrolls as a page does and the card keeps
            its own length; from `sm` the card fills what the header leaves. */}
        <div ref={body} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:gap-6 sm:pb-0 sm:overflow-visible sm:pt-0">
          {/* Julian: say what is being booked, over the card it books. */}
          <header className="flex flex-col gap-3 px-[var(--card-x,1.25rem)] pt-8 sm:px-0 sm:pt-0">
            <p className="label text-muted-foreground">You&apos;re booking</p>
            <h2 className="font-display text-4xl uppercase leading-[0.9] sm:text-6xl">{item.name}</h2>
            {item.blurb ? (
              <p className="text-[0.9375rem] normal-case leading-relaxed text-muted-foreground text-balance">{item.blurb}</p>
            ) : null}
          </header>
          <BookCard item={item} onClose={close} className="min-h-0 flex-1 max-sm:flex-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none max-sm:[container-type:inline-size]" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
