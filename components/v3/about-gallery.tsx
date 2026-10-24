"use client";

import * as React from "react";
import Image from "next/image";
import { ABOUT_PHOTO } from "@/lib/v3";

/* About hero gallery (master v50): a 1.2s crossfade every 6s like the cover;
   a tick or a click on the photo picks one, the caption follows. */
const FRAMES = [
  { src: ABOUT_PHOTO, w: 960, h: 1280, alt: "Julian Gigola sitting on stone steps under a tree", cap: "Julian Gigola, San Jose", pos: undefined },
  { src: "/about/julian-studio.jpg", w: 2048, h: 1365, alt: "Julian Gigola at a monitor on set in a studio", cap: "Julian Gigola, on set", pos: "30% 50%" },
];

export function AboutGallery() {
  const [i, setI] = React.useState(0);
  const [round, setRound] = React.useState(0);
  React.useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % FRAMES.length), 6000);
    return () => clearInterval(t);
  }, [round]);
  const pick = (n: number) => {
    setI(n);
    setRound((r) => r + 1);
  };
  return (
    <figure className="ab-photo">
      <div className="ab-frame" onClick={() => pick((i + 1) % FRAMES.length)}>
        {FRAMES.map((f, n) => (
          <Image key={f.src} src={f.src} alt={f.alt} width={f.w} height={f.h} sizes="(max-width: 800px) 100vw, 40vw" priority={n === 0} className={n === i ? "on" : undefined} style={f.pos ? { objectPosition: f.pos } : undefined} />
        ))}
      </div>
      <figcaption className="lbl mute">
        <span>{FRAMES[i].cap}</span>
        <span className="ticks">
          {FRAMES.map((_, n) => (
            <button key={n} type="button" className={n === i ? "on" : undefined} aria-label={`Photo ${n + 1}`} onClick={() => pick(n)} />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
