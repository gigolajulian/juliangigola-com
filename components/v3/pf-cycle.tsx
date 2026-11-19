"use client";

import * as React from "react";
import Image from "next/image";

/* `?pf=` prototypes (lib/pf.ts): a photo in view steps through a few more frames over itself, hard cuts,
   back to its own frame each round. The callers mount it only with the flag on and not `lite()`. */
export function Cycle({ srcs, sizes, ms = 1400 }: { srcs: string[]; sizes: string; ms?: number }) {
  const el = React.useRef<HTMLSpanElement>(null);
  const [n, setN] = React.useState(-1);
  React.useEffect(() => {
    let t = 0;
    const io = new IntersectionObserver(([x]) => {
      clearInterval(t);
      if (x.isIntersecting) t = window.setInterval(() => setN((i) => (i + 2 > srcs.length ? -1 : i + 1)), ms + Math.random() * 500);
    });
    io.observe(el.current!);
    return () => {
      io.disconnect();
      clearInterval(t);
    };
  }, [srcs, ms]);
  return (
    <span className="pf-cyc" ref={el} aria-hidden>
      {n >= 0 ? srcs.map((src, i) => <Image key={src} src={src} alt="" fill sizes={sizes} style={{ opacity: i === n ? 1 : 0 }} />) : null}
    </span>
  );
}
