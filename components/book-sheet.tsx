"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { BookCard } from "@/components/book-here";
import { InquireWall } from "@/components/inquire-wall";
import { gsap } from "gsap";
import { OMEGA } from "@/lib/motion/spring";
import type { WallTile } from "@/lib/wall-tile";
import type { MenuItem } from "@/lib/booking";

/* ── the booking sheet ─────────────────────────────────────────────
 * Julian, 2026-10-14: a session pressed, its card grows out of the row,
 * fills the screen over the session's wall, and goes back into the row
 * on X, Escape or a press outside it. The page under it never moves.
 *
 * It fades in, then the name, the blurb and the card come up one after
 * another; it fades out in about two thirds of the time. GSAP. The flip
 * in went (Julian, 2026-10-20). Lift (his pick, OKd 2026-10-21): the name
 * pressed in the list travels up to be the heading, and the rest rises
 * and comes sharp under it, on the deck's own spring. `?sheet=fade` keeps
 * the plain fade.
 * ─────────────────────────────────────────────────────────────────── */

const IN = 300; // ms, the fade in
const lift = () => typeof location === "undefined" || new URLSearchParams(location.search).get("sheet") !== "fade";

export function BookSheet({
  item,
  origin,
  wall,
  onClosed,
  chrome = false,
}: {
  item: MenuItem;
  /** Preview (`?cross=1`, Julian's mock of 2026-10-18): the wall runs
      full bleed under the bar and the footer, which stay over it, the
      bar at half and the footer clear (`contact.css`, `data-sheet`). The
      card alone, no header. */
  chrome?: boolean;
  /* The row pressed: the focus goes back to it on close. */
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
  /* The row's name, hidden while its copy is the heading. */
  const carried = React.useRef<HTMLElement | null>(null);

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
    if (chrome) root.dataset.sheet = "";
    return () => {
      root.style.overflow = was;
      delete root.dataset.sheet;
    };
  }, [chrome]);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    calm.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    ready.current = performance.now() + (calm.current ? 0 : IN);
    document.getElementById("book-card")?.focus({ preventScroll: true });
    const s = sheet.current;
    if (calm.current || !s) return;
    const parts = body.current ? [...body.current.querySelectorAll(":scope > header > *"), body.current.lastElementChild] : [];
    if (lift()) {
      // The deck's spring (critically damped, `RESPONSE`), settled by T.
      const T = 0.6;
      const w = OMEGA * T;
      const deck = (p: number) => (1 - (1 + w * p) * Math.exp(-w * p)) / (1 - (1 + w) * Math.exp(-w));
      ready.current = performance.now() + T * 1000;
      const name = s.querySelector<HTMLElement>("header h2");
      const from = origin?.querySelectorAll<HTMLElement>("span.font-display")[1];
      const rest = parts.filter((p) => !from || p !== name);
      gsap.fromTo(rest, { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: T, ease: deck, stagger: 0.06, delay: 0.08, clearProps: "opacity,transform,filter" });
      if (name && from) {
        const a = from.getBoundingClientRect();
        const b = name.getBoundingClientRect();
        const k = parseFloat(getComputedStyle(from).fontSize) / parseFloat(getComputedStyle(name).fontSize);
        carried.current = from;
        from.style.visibility = "hidden";
        gsap.fromTo(name, { x: a.left - b.left, y: a.top - b.top, scale: k, transformOrigin: "0 0" }, { x: 0, y: 0, scale: 1, duration: T, ease: deck, clearProps: "transform,transformOrigin" });
      }
      if (back.current) gsap.fromTo(back.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power1.out", clearProps: "opacity" });
      return;
    }
    gsap.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", clearProps: "opacity" });
    gsap.fromTo(parts, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out", stagger: 0.06, delay: 0.14, clearProps: "opacity" });
    if (back.current) gsap.fromTo(back.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out", clearProps: "opacity" });
  }, [mounted]);

  const close = React.useCallback(() => {
    if (going.current) return;
    going.current = true;
    const done = () => {
      if (carried.current) carried.current.style.visibility = "";
      onClosed();
      origin?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
    };
    const s = sheet.current;
    if (calm.current || !s) return done();
    gsap.killTweensOf([s, back.current, body.current]);
    gsap.to(body.current, { opacity: 0, duration: 0.14, ease: "power1.in" });
    gsap.to(back.current, { opacity: 0, duration: 0.3, ease: "power1.in" });
    if (lift()) gsap.to(s, { y: 16, filter: "blur(6px)", duration: 0.24, ease: "power2.in" });
    gsap.to(s, { opacity: 0, duration: lift() ? 0.24 : 0.2, ease: "power2.in", onComplete: done });
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
      className={
        chrome
          ? "fixed inset-0 z-[38] flex items-center justify-center overscroll-contain sm:px-[clamp(1rem,4vh,3rem)] sm:pb-[calc(var(--bar-h,4rem)+2.5rem)] sm:pt-[calc(var(--bar-h,4rem)+1rem)]"
          : "fixed inset-0 z-[90] flex items-center justify-center overscroll-contain sm:p-[clamp(1rem,4vh,3rem)]"
      }
    >
      {/* The session's wall, and a press on it closes the sheet. */}
      <div ref={back} className="absolute inset-0">
        {/* Inert: its tiles are links, and a press meant to close the
            sheet went to a project. */}
        <div inert className={`enquiry-backdrop questions-wall absolute overflow-hidden bg-background ${chrome ? "cross-wall -inset-6" : "inset-0"}`}>
          {wall?.length && !phone ? <InquireWall items={wall} /> : null}
        </div>
        <div aria-hidden onClick={() => performance.now() >= ready.current && close()} className="absolute inset-0" />
      </div>
      <div
        ref={sheet}
        data-book-frame
        className={`relative flex h-dvh w-full flex-col will-change-transform max-sm:bg-background ${item.cal ? "sm:h-[min(56rem,100%)] sm:w-[min(74rem,100%)]" : chrome ? "sm:h-[min(30rem,100%)] sm:w-[min(44rem,100%)]" : "sm:h-[min(46rem,100%)] sm:w-[min(46rem,100%)]"}`}
      >
        {/* On a phone the sheet scrolls as a page does and the card keeps
            its own length; from `sm` the card fills what the header leaves. */}
        <div ref={body} data-book-scroll className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:gap-6 sm:pb-0 sm:overflow-visible sm:pt-0">
          {/* Julian: say what is being booked, over the card it books. */}
          {chrome ? null : <header className="flex flex-col gap-3 px-[var(--card-x,1.25rem)] pt-8 sm:px-0 sm:pt-0">
            <p className="label text-muted-foreground">You&apos;re booking</p>
            <h2 className="font-display text-4xl uppercase leading-[0.9] sm:text-6xl">{item.name}</h2>
            {item.blurb ? (
              <p className="text-[0.9375rem] normal-case leading-relaxed text-muted-foreground text-balance">{item.blurb}</p>
            ) : null}
          </header>}
          <BookCard item={item} onClose={close} className="min-h-0 flex-1 max-sm:flex-none max-sm:mx-[3px] max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none max-sm:[container-type:inline-size]" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
