"use client";

import * as React from "react";
import Image from "next/image";
import { usePf } from "@/lib/pf";
import "./pf-ref.css";

/* `?pf=open` (lib/pf.ts): the project opens as one full-height row of its photos, read sideways,
   from a reference's project view (Julian, 2026-11-19). The wheel moves the row until it runs out,
   then the page carries on to the credits. pf-ref.css hides the usual hero and sheet while it is on.
   Renders nothing without the flag. */
export type PfFrame = { src: string; alt: string; w: number; h: number; color?: string };

export function PfRow({ frames, name, sub }: { frames: PfFrame[]; name: string; sub: string }) {
  const on = usePf("open");
  const row = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!on) return;
    const html = document.documentElement;
    html.setAttribute("data-pf-open", "");
    const r = row.current!;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch zoom and sideways swipes stay native
      const max = r.scrollWidth - r.clientWidth;
      // only while the row is the thing on screen and has room to go that way
      if (r.getBoundingClientRect().top < -8 || (e.deltaY > 0 ? r.scrollLeft >= max - 1 : r.scrollLeft <= 0)) return;
      e.preventDefault();
      r.scrollLeft += e.deltaY;
    };
    r.addEventListener("wheel", wheel, { passive: false });
    return () => {
      html.removeAttribute("data-pf-open");
      r.removeEventListener("wheel", wheel);
    };
  }, [on]);
  if (!on) return null;
  return (
    <div className="pf-row-w">
      <div className="pf-row" ref={row} tabIndex={0} data-lenis-prevent aria-label={`${name}, ${frames.length} frames`}>
        {frames.map((f, i) => (
          <figure key={f.src} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
            <Image src={f.src} alt={f.alt} fill sizes="(max-width: 700px) 90vw, 70vh" priority={i < 2} style={{ objectFit: "cover", background: f.color }} />
          </figure>
        ))}
      </div>
      <p className="lbl pf-row-cap">
        {name} {sub ? <span className="mute">{sub}</span> : null}
      </p>
    </div>
  );
}
