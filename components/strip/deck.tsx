import { runDeck, type Deck } from "@/lib/deck";
import * as React from "react";
import { flushSync } from "react-dom";
import { leftOf, nav, POP_MS, SECTIONS_FIRST } from "./shared";

/* ── the deck, and the sections it deals ──────────────────────────
 * Which of a strip's cells are mounted yet (`defer`), and the deck that
 * deals them (`lib/deck.ts`).
 * ─────────────────────────────────────────────────────────────── */

/** The cells a strip shows (`shown`), and whether any are still held
    back (`holding`). */
export function useSections(
  children: React.ReactNode,
  defer: boolean,
  deck: Deck | undefined,
) {
  /* Julian (2026-10-01): only the discipline being shown and the next.
     Arriving at the portfolio built all ninety three projects inside the
     page transition, 1,100 elements and 130ms of long tasks with the
     screen held; a discipline page of 300 had none. So a navigation here
     mounts the first two sections, and the rest follow a section at a
     time once the arrival is over (`data-nav` gone from the root) and the
     page is idle: all at once, mid-transition, they cost 87ms and seven
     dropped frames. Whole at once when the visitor is coming back to a
     place in it (the back button's seat, a #discipline typed in), and
     always on the server and the cold load, so the markup and the
     crawlers have every project. Not the hash at render: the address
     still holds the page being left (`/#where-next`).
     A deck of screens (the homepage) mounts the one it lands on: coming
     back from the portfolio, the second screen's eight covers and logos
     were built inside the swap, while the screen held for 300ms
     (scroll-craft pass, 2026-10-02). */
  const [sections, setSections] = React.useState(() =>
    !defer || !nav.hydrated || Date.now() - nav.poppedAt < POP_MS || Date.now() - nav.aimedAt < POP_MS
      ? Infinity
      : deck === "screens"
        ? 1
        : SECTIONS_FIRST,
  );
  /* Whether anything is still held back is this memo's to say, not a count
     of the two: `Children.count` counts an empty child and `toArray` drops
     it, so a page with one (the homepage) counted its children at eight
     and the sections shown at seven for ever. Coming back from the
     portfolio, that asked for more sections at every idle slot without
     end, and each one dealt the deck again: the hero lost its `data-buried`
     and its photographs showed under the glass as a grey band, and the
     paging lost its places and the wheel stuck (Julian, 2026-10-02). */
  const [shown, holding] = React.useMemo(() => {
    if (sections === Infinity) return [children, false] as const;
    const all = React.Children.toArray(children);
    let heads = 0;
    /* A section opens on the cell marked `data-deck`, as the deck reads
       it: rendered on the server, it reaches here as that element, not as
       the component that drew it. On the homepage every screen is one. */
    const opens = (c: React.ReactNode) =>
      deck === "screens" ||
      (React.isValidElement<Record<string, unknown>>(c) && "data-deck" in c.props);
    const cut = all.findIndex((c) => opens(c) && ++heads > sections);
    if (cut < 0) return [all, false] as const;
    /* The later sections' openings go in now, only their covers wait:
       the ruler reads its chapters off them, and with two of thirteen it
       drew fifty six ticks until the rest arrived. */
    if (deck !== "screens")
      return [[...all.slice(0, cut), ...all.slice(cut).filter(opens)], true] as const;
    /* A screen waits as an empty one in its place, so the rail has all
       its ticks and the strip its whole length from the first frame, and
       the screen comes in where it already stood. Coming back from the
       portfolio the rail grew a tick at a time for a second or more
       (Julian: the scrollbar takes a minute to load). The window into the
       work is no screen: zero wide and tickless, it goes in as it is. It
       is told by the covers it is handed, not by its type: from the
       server it reaches here wrapped, never as `LeadWindow` itself. */
    return [
      [
        ...all.slice(0, cut),
        ...all.slice(cut).map((c, i) =>
          React.isValidElement<Record<string, unknown>>(c) && "covers" in c.props ? (
            c
          ) : (
            <div
              key={`held-${cut + i}`}
              data-held=""
              data-tick=""
              aria-hidden
              className="w-full shrink-0 sm:h-full"
            />
          ),
        ),
      ],
      true,
    ] as const;
  }, [children, sections, deck]);
  React.useEffect(() => {
    nav.hydrated = true;
  }, []);
  return { sections, setSections, shown, holding };
}

/** Deals the deck, again as each held-back section arrives, and says
    whether any are still held back to the wheel (`heldBack`). */
export function useDeal({
  scroller: scrollerRef,
  deck,
  shown,
  sheet,
  holding,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  deck: Deck | undefined;
  shown: React.ReactNode;
  sheet: boolean;
  holding: boolean;
}) {
  /* For the wheel, whose effect must not run again as sections arrive. */
  const heldBack = React.useRef(false);
  React.useEffect(() => {
    heldBack.current = holding;
  }, [holding]);
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!deck || !el || sheet) return;
    return runDeck(el, deck);
    // Dealt again as each held-back section arrives.
  }, [scrollerRef, deck, shown, sheet]);
  return heldBack;
}

/** Brings the held-back sections in: once the page has landed and gone
    quiet, as the strip comes near them, and all at once on a hash. */
export function useMoreSections({
  scroller: scrollerRef,
  holding,
  still,
  sections,
  setSections,
  deck,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  holding: boolean;
  still: boolean;
  sections: number;
  setSections: React.Dispatch<React.SetStateAction<number>>;
  deck: Deck | undefined;
}) {
  React.useEffect(() => {
    // Never under a moving strip: each section deals the deck again.
    if (!holding || !still) return;
    const root = document.documentElement;
    let idle = 0;
    /* Not in `startTransition`: here that runs the page-wide view
       transition (`page-transition.tsx`), and every section crossfaded the
       whole page, a ghost of the hero each second after landing. */
    const more = () => setSections((n) => n + 1);
    const later = () => {
      idle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(more, { timeout: 1500 })
          : window.setTimeout(more, 200);
    };
    const landed = new MutationObserver(() => {
      if (root.dataset.nav !== undefined) return;
      landed.disconnect();
      later();
    });
    if (root.dataset.nav === undefined) later();
    else landed.observe(root, { attributes: true, attributeFilter: ["data-nav"] });
    return () => {
      landed.disconnect();
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
    };
  }, [holding, sections, still, setSections]);
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!holding || !el) return;
    /* A strip that keeps moving never rests for the idle path above, and
       ran on past openings with nothing behind them (Julian, 2026-10-02).
       So the next section also comes in once it is a screen and a half
       away, moving or not. */
    let asked = false;
    const near = () => {
      if (asked) return;
      const next =
        deck === "screens"
          ? el.querySelector<HTMLElement>(":scope > [data-held]")
          : el.querySelectorAll<HTMLElement>(":scope > [data-deck]")[sections];
      /* A held screen by where it stands in layout: the deck pins it, and
         a pinned one reads as wherever the window is. */
      const ahead = !next
        ? el.scrollWidth - el.scrollLeft - el.clientWidth
        : deck === "screens"
          ? leftOf(next) - el.scrollLeft - el.clientWidth
          : next.getBoundingClientRect().left - el.getBoundingClientRect().right;
      if (ahead > el.clientWidth * 1.5) return;
      asked = true;
      setSections((n) => n + 1);
    };
    el.addEventListener("scroll", near, { passive: true });
    // Before the strip's own listener looks for the cell (`onHash`).
    const onHash = () => flushSync(() => setSections(Infinity));
    window.addEventListener("hashchange", onHash);
    return () => {
      el.removeEventListener("scroll", near);
      window.removeEventListener("hashchange", onHash);
    };
  }, [scrollerRef, holding, sections, deck, setSections]);
}
