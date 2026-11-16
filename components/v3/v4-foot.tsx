"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOOK_ROWS, QUOTE_OPTS } from "./mt/data";
import { useLocalTime } from "./mt/foot";
import { media } from "@/lib/device";

/* The ending of an inner page, on trial (`?v4pages=foot`, inner-pages plan g1):
   the V4 home footer without its photo wall, about half a screen tall. Four
   link columns with Book online first, a drifting phrase ("Book me" and its variants) as one
   plain link to /book (no card is mounted here), then the last line. On
   desktop the page's last block sinks and dims while this slides over it.
   Styles: app/styles/v4pages.css. */
/* Julian's lines (2026-11-15). A project page takes one by its slug, so it reads the same on every visit; every other page says the first. */
const PHRASES = ["Book me", "Shoot with me", "You're next", "Work with me", "Book a shoot", "Bring me your idea", "Book your next shoot", "Book a session with me", "Make something with me", "Plan a shoot with me", "Your idea, on camera"];
const phraseFor = (path: string) => {
  const slug = path.match(/^\/portfolio\/([^/]+)$/)?.[1];
  if (!slug || slug === "video") return PHRASES[0];
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PHRASES[h % PHRASES.length];
};
/* The inquiry form's types (components/v3/inquire.tsx TYPE); weddings has none, so it opens the form plain. */
const ASK: Record<string, string> = { music: "coverart", fashion: "editorial", commercial: "campaign" };
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function V4Foot() {
  const foot = React.useRef<HTMLElement>(null);
  const row = React.useRef<HTMLSpanElement>(null);
  const time = useLocalTime();
  const year = new Date().getFullYear();
  const phrase = phraseFor(usePathname());

  React.useEffect(() => {
    const el = foot.current, r = row.current;
    if (!el || !r || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mqD = media("held");
    // What sinks: a block that names itself (the project page's Next), else the one right above the footer.
    let sink = document.querySelector<HTMLElement>("[data-sink]") ?? (el.previousElementSibling as HTMLElement | null);
    // a block hidden at this size (the phone list on /portfolio/video) is skipped
    while (sink && !sink.offsetHeight && sink.previousElementSibling) sink = sink.previousElementSibling as HTMLElement;
    let raf = 0, t0 = 0, y0 = scrollY, x = 0, v = 0, pk = 0, W = 0, out = 0, hot = false;
    // What moves: the block, or on a grid (/portfolio) only the tiles in its last screen. Sinking and dimming
    // the whole grid while its photos drift dropped frames (Julian, 2026-11-16).
    let parts: HTMLElement[] = [];
    const setOut = (o: number) => {
      if (!sink || o === out) return;
      if (!out) {
        const tiles = sink.querySelectorAll<HTMLElement>(".wgrid .wt");
        parts = tiles.length ? [...tiles].filter((t) => t.getBoundingClientRect().bottom > -innerHeight) : [sink];
      }
      out = o;
      // only while the footer is arriving: at rest nothing has a transform or a layer
      for (const p of parts) {
        p.toggleAttribute("data-v4-sink", o > 0);
        if (o > 0) p.style.setProperty("--out", o.toFixed(3));
        else p.style.removeProperty("--out");
      }
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(50, now - (t0 || now));
      t0 = now;
      const dy = scrollY - y0;
      y0 = scrollY;
      const b = el.getBoundingClientRect();
      // 0 as the footer's top reaches the bottom of the screen, 1 once it is all up. Not on a page too short to scroll it in.
      setOut(mqD.matches && document.documentElement.scrollHeight - innerHeight >= b.height ? clamp((innerHeight - b.top) / b.height) : 0);
      // The phrase drift of mt/motion/foot.ts: 68 design px a second, 54 under the pointer, plus what the scroll adds.
      const u = clamp(Math.min(innerWidth / 1440, innerHeight / 900), 0.7, 1.6);
      W ||= (r.firstElementChild as HTMLElement).getBoundingClientRect().width;
      pk = clamp(pk * Math.pow(0.94, dt / 16.7) + dy * 0.0012, -0.35, 0.35);
      if (Math.abs(pk) < 0.0005) pk = 0;
      v += ((hot ? 0.054 : 0.068) * u + pk - v) * (1 - Math.exp(-dt / 180));
      x += v * dt;
      r.style.transform = `translate3d(${(-(((x % W) + W) % W || 0)).toFixed(1)}px,0,0)`;
    };
    const io = new IntersectionObserver(
      ([e]) => {
        cancelAnimationFrame(raf);
        t0 = 0;
        y0 = scrollY;
        if (e.isIntersecting) raf = requestAnimationFrame(tick);
        else setOut(0);
      },
      { rootMargin: "50% 0px" },
    );
    io.observe(el);
    const size = () => (W = 0);
    const over = (e: PointerEvent) => (hot = e.type === "pointerenter" && e.pointerType === "mouse");
    addEventListener("resize", size);
    const link = r.parentElement!;
    link.addEventListener("pointerenter", over);
    link.addEventListener("pointerleave", over);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener("resize", size);
      link.removeEventListener("pointerenter", over);
      link.removeEventListener("pointerleave", over);
      setOut(0);
    };
  }, []);

  return (
    <footer className="v4f" ref={foot}>
      <nav className="v4f-cols lbl" aria-label="Footer">
        <div>
          <p className="mute">Book online</p>
          {BOOK_ROWS.map((b) => (
            <p key={b.key}><Link href={`/book/${b.slug}`}>{b.name}</Link></p>
          ))}
        </div>
        <div>
          <p className="mute">Inquire</p>
          {QUOTE_OPTS.map((o) => (
            <p key={o.key}><Link href={ASK[o.key] ? `/contact/form?type=${ASK[o.key]}` : "/contact/form"}>{o.name}</Link></p>
          ))}
        </div>
        <div>
          <p className="mute">Pages</p>
          <p><Link href="/portfolio">Portfolio</Link></p>
          <p><Link href="/book">Sessions</Link></p>
          <p><Link href="/about">About</Link></p>
        </div>
        <div>
          <p className="mute">Reach</p>
          <p><a href="mailto:hello@juliangigola.com"><span className="dk">hello@juliangigola.com</span><span className="po">Email me</span></a></p>
          <p><a href="https://instagram.com/juliangigola" rel="noopener"><span className="dk">Instagram&nbsp;</span>@juliangigola</a></p>
          <p className="mute v4f-based">Based</p>
          <p><span className="dk">San Francisco Bay Area</span><span className="po">SF Bay Area</span></p>
        </div>
      </nav>
      <Link className="v4f-phrase" href="/book" aria-label={phrase}>
        {/* shortcut: five copies cover a 3440px screen; add more if the phrase gets shorter or screens wider */}
        <span className="v4f-row" ref={row} aria-hidden>
          {[0, 1, 2, 3, 4].map((n) => <span key={n}>{phrase}</span>)}
        </span>
      </Link>
      <div className="v4f-line lbl mute">
        <span>&copy; {year} Julian Gigola</span>
        {time ? <span className="v4f-time"><span className="dk">San Jose </span><span className="t">{time}</span></span> : null}
        <Link href="/legal">Legal</Link>
      </div>
    </footer>
  );
}
