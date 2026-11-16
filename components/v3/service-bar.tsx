"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { v4pages } from "@/lib/v4pages";

/* ?v4pages=s1: the phone book bar on a service page. Held at the bottom once
   the hero buttons have scrolled away; gone while the booking is on screen
   (the flow has its own Continue bar, the two never stack) and on the last
   screen. A link to the page's own #book anchor, nothing more. */
export function ServiceBar({ name, rate, label, href }: { name: string; rate: string; label: string; href: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !v4pages("s1")) return;
    const hero = document.querySelector("#p-service .sv-top .ctas");
    const book = document.querySelector("#p-service #book");
    const end = document.querySelector("#p-service [data-sv-end]");
    // the observer only says when an edge crossed the screen; the rects say where things are
    const update = () => {
      const vh = innerHeight;
      const b = book?.getBoundingClientRect();
      const on = !!hero && hero.getBoundingClientRect().bottom < 0 && !(b && b.top < vh && b.bottom > 0) && !(end && end.getBoundingClientRect().top < vh);
      el.toggleAttribute("data-on", on);
    };
    const io = new IntersectionObserver(update);
    for (const n of [hero, book, end]) if (n) io.observe(n);
    return () => {
      io.disconnect();
      el.removeAttribute("data-on");
    };
  }, []);
  return (
    <div className="sv-bar" ref={ref}>
      <p className="lbl">
        {name}
        <span className="mute">{rate}</span>
      </p>
      <Link className="btn fill" href={href}>{label}</Link>
    </div>
  );
}
