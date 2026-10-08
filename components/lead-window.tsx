"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { IndexRow } from "@/lib/work";
import { useWorkView } from "@/lib/work-view";

/* ── the window into the work ─────────────────────────────────────
 * Julian (2026-10-01): past the last screen of the homepage, a peek of the
 * portfolio, so the visitor knows it is opening. Nothing at rest.
 *
 * The deck the other way round (Julian: the card swipe reversed, and
 * match the peek and the page): the homepage is the card on top, and
 * pushing past its last screen slides it off the portfolio, which is
 * under it all along, set back and out of focus (`lead-under` in
 * `globals.css`). Past the count the homepage flies out to the left and
 * the portfolio comes up into focus from exactly that (`open`); back from
 * the portfolio's start is the door shutting into the hero (`shut`).
 *
 * What is under it is the portfolio's first screen in its strip view: the
 * spine, standing under Portfolio as the page's does (`chapter-alias`),
 * and its first covers, the same files at the same `sizes` as the page's
 * (`cover-cell.tsx`), so they are in the cache when it arrives.
 * ─────────────────────────────────────────────────────────────── */

/** Where the homepage's trailing edge is, for the flight to start from. */
export const openFrom = (win: HTMLElement) => {
  const shown = parseFloat(win.style.getPropertyValue("--lead-pull")) || 0;
  document.documentElement.style.setProperty(
    "--lead-from",
    `${Math.max(0, window.innerWidth - shown)}px`,
  );
};

export function LeadWindow({ covers }: { covers: IndexRow[] }) {
  const router = useRouter();
  /* As the page will be: the strip for everybody who has not said
     otherwise, the rack for a visitor who keeps the grid (`work-view`).
     The card came in as the strip and the page landed as the grid, and
     the grid's own covers came in white (Julian, 2026-10-02). A screen of
     the rack is ten or twelve covers, so the rack takes every cover it
     is handed and the strip its first three; their pictures are the
     page's own at the page's own sizes, so the landing finds them cached. */
  const grid = useWorkView() === "grid";
  const shown = grid ? covers : covers.slice(0, 3);
  const self = React.useRef<HTMLAnchorElement>(null);
  /* The covers load with the prefetch, once the last screen is in sight.
     Not on a phone, where there is no window (the observer never fires). */
  const [near, setNear] = React.useState(false);
  /* The portfolio fetched once the window is in sight, so the door opens
     on the page rather than on a wait for it. One request, for a visitor
     who has come to the end of the homepage; prefetch stays off on links
     everywhere else (request volume). */
  React.useEffect(() => {
    const el = self.current;
    // The window has no width of its own: watched by the last screen.
    const last = el?.previousElementSibling;
    if (!el || !last) return;
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting || !el.getClientRects().length) return;
        seen.disconnect();
        router.prefetch("/portfolio");
        setNear(true);
      },
      { threshold: 0.5 },
    );
    seen.observe(last);
    return () => seen.disconnect();
  }, [router]);

  return (
    <Link
      ref={self}
      href="/portfolio"
      data-lead-window
      aria-label="Portfolio"
      className="lead-window"
      /* A press is the same door as the scroll. The bar's handler has
         already marked the trip a step in; this names it. */
      onClick={(e) => {
        openFrom(e.currentTarget);
        document.documentElement.dataset.navSide = "open";
      }}
    >
      {/* Inside the pane, which clips it: outside, waiting past the
          window's edge, it made the strip 165px longer than its screens. */}
      <span className="lead-pane" aria-hidden>
        <span className="lead-under">
          <span className={grid ? "lead-row strip-grid" : "lead-row"}>
            <span className="lead-spine">
              {/* An h2, as the page's spine is: the face is the heading's. */}
              <h2
                style={{ "--n": 9 } as React.CSSProperties}
                className="chapter-name font-display uppercase leading-[0.95] tracking-[0]"
              >
                Portfolio
              </h2>
            </span>
            {shown.map(({ cover: c, name, credit }) => (
              <span
                key={c.src}
                className="lead-cover"
                style={{
                  // The rack prints every cover 4:5 (`strip-grid`).
                  aspectRatio: grid ? undefined : `${c.width} / ${c.height}`,
                  backgroundColor: c.color,
                }}
              >
                {near && (
                  <Image
                    src={c.src}
                    alt=""
                    fill
                    loading="eager"
                    draggable={false}
                    sizes={`(min-width: 640px) and (min-resolution: 2.5dppx) calc((100vh - 10rem) * ${((c.width / c.height) * 0.667).toFixed(3)}), (min-width: 640px) calc((100vh - 10rem) * ${(c.width / c.height).toFixed(3)}), 100vw`}
                    className="object-cover"
                  />
                )}
                {/* The page's slate (`cover-cell.tsx`), credit and name. */}
                <span className="cover-slate absolute inset-x-0 bottom-0 flex flex-col items-start gap-[1.2cqw] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-[5cqw] pb-[4.5cqw] pt-[16cqw]">
                  <span className="label min-w-0 max-w-full truncate text-[clamp(0.625rem,1.6cqw,0.75rem)] leading-none text-white/75">
                    {credit}
                  </span>
                  <span
                    style={{ "--n": name.length } as React.CSSProperties}
                    className="cover-name font-display min-w-0 max-w-full truncate uppercase leading-[0.9] text-white"
                  >
                    {name}
                  </span>
                </span>
              </span>
            ))}
          </span>
        </span>
      </span>
    </Link>
  );
}
