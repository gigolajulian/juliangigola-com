"use client";

import * as React from "react";
import Image from "next/image";
import { useV4pages } from "@/lib/v4pages";

export type HeldSpot = { name: string; note: string; src: string; alt: string; color?: string };

/* ?v4pages=s4 (inner pages plan): a campus guide's spots held beside their photo. The rows scroll on the
   left, the photo on the right stays and cuts to the row at mid screen (the V4 home's Book online: lit row,
   photo following). One list in document order, photo then row, which is the page as it is on phones and
   under reduced motion; the hold is CSS only (app/styles/v4pages.css). `off` is the rows as they are live. */
export function CampusSpots({ off, spots }: { off: React.ReactNode; spots: HeldSpot[] }) {
  const on = useV4pages("s4");
  const box = React.useRef<HTMLDivElement>(null);
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    if (!on) return;
    // The row crossing the middle of the screen. Between rows or past the list, the last one stays.
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setCur(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    box.current?.querySelectorAll(".s4-row").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [on]);
  if (!on) return off;
  return (
    <div className="s4" ref={box} style={{ "--n": spots.length } as React.CSSProperties}>
      {spots.map((s, i) => (
        <React.Fragment key={s.name}>
          <figure className="s4-ph" data-on={i === cur || undefined}>
            <Image src={s.src} alt={s.alt} fill sizes="(max-width: 1023px) 100vw, 40vw" style={{ objectFit: "cover", background: s.color }} />
          </figure>
          <section className="s4-row" data-i={i} data-on={i === cur || undefined} style={{ "--i": i + 1 } as React.CSSProperties}>
            <h2><span className="lbl mute">{String(i + 1).padStart(2, "0")}</span> {s.name}</h2>
            <p>{s.note}</p>
          </section>
        </React.Fragment>
      ))}
    </div>
  );
}
