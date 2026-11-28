"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useDs } from "@/lib/flags/ds";
import { v4pages } from "@/lib/flags/v4pages";
import type { SpreadBlock } from "@/lib/work/spreads";

/* The project page's pieces of the design system preview (`?ds`, lib/flags/ds.ts), kept out of the
   server component. With the flag off nothing here reaches the page. */

export type DsFrame = { src: string; width: number; height: number; color?: string; alt: string };

const nn = (n: number) => String(n).padStart(2, "0");
const SIZES: Record<SpreadBlock["kind"], string> = {
  pair: "50vw",
  row: "(max-width: 700px) 100vw, 34vw",
  full: "(max-width: 700px) 100vw, 70vw",
};

/** The frames after the hero as edited spreads (pair, row of three, full), and the phone's counter bar. */
export function DsSpreads({ frames, blocks, ask }: { frames: DsFrame[]; blocks: SpreadBlock[]; ask: string }) {
  const on = useDs();
  const [at, setAt] = React.useState(1);
  const [end, setEnd] = React.useState(false);
  const n = frames.length;

  // the bar counts the frame that holds the middle of the screen
  React.useEffect(() => {
    if (!on) return;
    const figs = [...document.querySelectorAll("#p-project .pj-big, #p-project .ds-fr")];
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setAt(figs.indexOf(e.target) + 1)), {
      rootMargin: "-50% 0px -50% 0px",
    });
    figs.forEach((f) => io.observe(f));
    // past the last frame (the Next band on screen) the bar steps out
    const next = document.querySelector("#p-project .pj-next");
    const done = new IntersectionObserver(([e]) => setEnd(e.isIntersecting || e.boundingClientRect.top < 0));
    if (next) done.observe(next);
    return () => {
      io.disconnect();
      done.disconnect();
    };
  }, [on]);

  if (!on) return null;
  const opens = v4pages("view");
  return (
    <>
      <div className="ds-sp">
        {blocks.map((b) => (
          <div key={b.frames[0]} className={`ds-b ds-${b.kind}`}>
            <div className="ds-b-r">
              {b.frames.map((i) => {
                const f = frames[i];
                return (
                  <figure
                    key={f.src}
                    className={f.width > f.height ? "ds-fr w" : "ds-fr"}
                    style={{ "--ar": (f.width / f.height).toFixed(4) } as React.CSSProperties}
                    {...(opens ? { tabIndex: 0, role: "button", "aria-label": `Open frame ${i + 1} of ${n}` } : {})}
                  >
                    <Image
                      src={f.src}
                      alt={f.alt}
                      fill
                      sizes={f.width > f.height ? "100vw" : SIZES[b.kind]}
                      style={{ objectFit: "cover", background: f.color }}
                    />
                  </figure>
                );
              })}
            </div>
            <p className="ds-cap lbl mute">{b.frames.map((i) => nn(i + 1)).join(" · ")}</p>
          </div>
        ))}
      </div>
      {/* On <body>: the page's wrapper holds fixed boxes to the page, and the bar belongs to the screen. */}
      {createPortal(
        <div className="v3 contents">
          <div className="ds-bar" data-end={end ? "" : undefined} inert={end}>
            <span className="lbl mute">
              <b>{nn(at)}</b> / {nn(n)}
            </span>
            <Link className="btn fill" href={ask}>
              Inquire
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** The credits fold: the rows that always show, the rest behind "+ N more", which opens in place. */
export function DsCredits({ shown, folded, last }: { shown: React.ReactNode; folded: React.ReactNode[]; last: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <dl className={open ? "ds-cr op" : "ds-cr"}>
      {shown}
      {open ? folded : null}
      {folded.length ? (
        <>
          <dt />
          <dd>
            <button type="button" className="ds-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Show less" : `+ ${folded.length} more`}
            </button>
          </dd>
        </>
      ) : null}
      {last}
    </dl>
  );
}
