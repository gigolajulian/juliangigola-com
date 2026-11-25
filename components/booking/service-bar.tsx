"use client";

import Link from "next/link";
import * as React from "react";
import { createPortal } from "react-dom";
import { noSubscribe } from "@/lib/utils";

/* The phone book bar on a service page. Held at the bottom once
   the hero buttons have scrolled away; gone while the booking is on screen
   (the flow has its own Continue bar, the two never stack) and on the last
   screen. A link to the page's own #book anchor, nothing more.
   Mounted on <body>: <main> carries a transform, which would pin a fixed bar
   to the page's bottom instead of the screen's. Nothing renders on the server, where there is no <body>. */
export function ServiceBar({ name, rate, label, href }: { name: string; rate: string; label: string; href: string }) {
  const on = React.useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const hero = document.querySelector("#p-service .sv-top .ctas");
    const book = document.querySelector("#p-service #book");
    const end = document.querySelector("#p-service [data-sv-end]");
    // the observer only says when an edge crossed the screen; the rects say where things are
    const update = () => {
      const vh = innerHeight;
      const b = book?.getBoundingClientRect();
      const show =
        !!hero &&
        hero.getBoundingClientRect().bottom < 0 &&
        !(b && b.top < vh && b.bottom > 0) &&
        !(end && end.getBoundingClientRect().top < vh);
      el.toggleAttribute("data-on", show);
    };
    const io = new IntersectionObserver(update);
    for (const n of [hero, book, end]) if (n) io.observe(n);
    return () => io.disconnect();
  }, [on]);
  if (!on) return null;
  return createPortal(
    <div className="v3 contents">
      <div className="sv-bar" ref={ref}>
        <p className="lbl">
          {name}
          <span className="mute">{rate}</span>
        </p>
        <Link className="btn fill" href={href}>
          {label}
        </Link>
      </div>
    </div>,
    document.body,
  );
}
