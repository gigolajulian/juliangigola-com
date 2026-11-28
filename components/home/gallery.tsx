"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { HomeGalFrame } from "@/lib/home/data";
import { projectHref } from "@/lib/work/project-href";
import { pad } from "@/lib/utils";

/* ds (mock N3): a full-screen gallery on the home, between Commissions and Sessions. One frame edge to edge with
   one mono line. It plays by itself, a new frame every 4 seconds with a hard cut (DESIGN.md: Hard Cut), holds under the
   pointer or keyboard focus and off screen, and stays still for reduced motion. A click or tap steps it.
   Only this frame and the next are in the page, so it costs two photos to start and one a step. */
const EVERY = 4000;

export function HomeGallery({ frames }: { frames: HomeGalFrame[] }) {
  const [at, setAt] = React.useState(0);
  const root = React.useRef<HTMLElement>(null);
  const n = frames.length;
  const step = () => setAt((i) => (i + 1) % n);

  React.useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let seen = false;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    const id = setInterval(() => {
      if (seen && !document.hidden && !el.matches(":hover, :focus-within")) setAt((i) => (i + 1) % n);
    }, EVERY);
    return () => (clearInterval(id), io.disconnect());
  }, [n]);

  if (!n) return null;
  const f = frames[at];
  return (
    <section className="ds-gal" aria-label="Gallery" ref={root}>
      {[at, (at + 1) % n].map((i, k) => (
        <Image
          key={frames[i].src}
          src={frames[i].src}
          alt={k ? "" : frames[i].name}
          fill
          sizes="(max-width: 599px) 330vw, 100vw"
          style={{ objectFit: "cover", "--x": `${frames[i].x}%`, visibility: k ? "hidden" : undefined } as React.CSSProperties}
        />
      ))}
      <button type="button" className="ds-gal-step" aria-label="Next frame" onClick={step} />
      <div className="ds-gal-tk" aria-hidden>
        {frames.map((g, i) => (
          <i key={g.src} data-on={i === at ? "" : undefined} />
        ))}
      </div>
      <p className="ds-gal-cap lbl">
        <span>
          {pad(at + 1)} / {pad(n)} · {f.title}
        </span>
        <Link href={projectHref(f.slug)}>See the project →</Link>
      </p>
    </section>
  );
}
